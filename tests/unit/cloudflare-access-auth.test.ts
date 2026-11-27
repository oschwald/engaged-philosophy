import { env as workersEnv } from "cloudflare:workers";
import {
	errors,
	exportJWK,
	exportSPKI,
	generateKeyPair,
	SignJWT,
	type CryptoKey,
	type JWK,
	type JWTPayload,
} from "jose";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from "vitest";

import { authenticate } from "../../src/lib/cloudflare-access-auth";

const AUDIENCE = "test-access-audience";
const KEY_ID = "test-access-key";
const ALG = "RS256";

let signingKey: CryptoKey;
let otherSigningKey: CryptoKey;
let publicJwk: JWK;
let publicKeyPem: string;
let teamDomain: string;
let teamCounter = 0;
const requestedUrls: string[] = [];
let certsResponse: () => Response;

// authenticate() caches one remote JWKS per team domain, so each test gets
// its own domain to keep fetches and cached keys independent.
function nextTeamDomain() {
	teamCounter += 1;
	return `team-${teamCounter}.cloudflareaccess.test`;
}

function accessConfig(overrides: Record<string, unknown> = {}) {
	return { teamDomain, audienceEnvVar: "CF_ACCESS_AUDIENCE", ...overrides };
}

async function signToken(
	claims: JWTPayload = {},
	{
		key = signingKey,
		issuer = `https://${teamDomain}`,
		// Cloudflare Access sends the application AUD tag in an array.
		audience = [AUDIENCE],
		expiresAt = "5m",
		keyId = KEY_ID,
		notBefore,
	}: {
		key?: CryptoKey;
		issuer?: string;
		audience?: string | string[];
		// null omits the exp claim.
		expiresAt?: string | number | null;
		keyId?: string;
		notBefore?: string | number;
	} = {},
) {
	const token = new SignJWT({ email: "editor@example.com", ...claims })
		.setProtectedHeader({ alg: ALG, kid: keyId })
		.setIssuer(issuer)
		.setAudience(audience)
		.setSubject("access-user-id")
		.setIssuedAt();
	if (expiresAt !== null) token.setExpirationTime(expiresAt);
	if (notBefore !== undefined) token.setNotBefore(notBefore);
	return token.sign(key);
}

// jose refuses non-asymmetric algorithms for a remote JWKS today, and an
// explicit algorithm allow-list would refuse them before fetching keys.
function isAlgorithmRejection(error: unknown) {
	const code = (error as { code?: string }).code;
	return (
		code === "ERR_JOSE_NOT_SUPPORTED" || code === "ERR_JOSE_ALG_NOT_ALLOWED"
	);
}

const FROZEN_NOW_SECONDS = Date.UTC(2026, 0, 1) / 1000;

// Pin Date so clock-tolerance boundary tests do not depend on test speed.
function freezeClock() {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(FROZEN_NOW_SECONDS * 1000);
}

function requestWithHeader(jwt: string) {
	return new Request("https://example.com/_emdash/admin", {
		headers: { "Cf-Access-Jwt-Assertion": jwt },
	});
}

beforeAll(async () => {
	const keyPair = await generateKeyPair(ALG);
	signingKey = keyPair.privateKey;
	publicJwk = {
		...(await exportJWK(keyPair.publicKey)),
		kid: KEY_ID,
		alg: ALG,
		use: "sig",
	};
	publicKeyPem = await exportSPKI(keyPair.publicKey);
	otherSigningKey = (await generateKeyPair(ALG)).privateKey;
});

beforeEach(() => {
	teamDomain = nextTeamDomain();
	requestedUrls.length = 0;
	certsResponse = () => Response.json({ keys: [publicJwk] });
	vi.stubEnv("CF_ACCESS_AUDIENCE", AUDIENCE);
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL) => {
			const url = input instanceof Request ? input.url : String(input);
			requestedUrls.push(url);
			if (!url.endsWith("/cdn-cgi/access/certs")) {
				return new Response("not found", { status: 404 });
			}
			return certsResponse();
		}),
	);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	delete (workersEnv as Record<string, string | undefined>).CF_ACCESS_AUDIENCE;
});

describe("Cloudflare Access authenticate", () => {
	test("accepts a valid token signed by the team's Access key", async () => {
		const jwt = await signToken({ name: "Edith Editor" });

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).resolves.toEqual({
			email: "editor@example.com",
			name: "Edith Editor",
			role: 30,
			subject: "access-user-id",
			metadata: { groups: [], idp: undefined },
		});
		expect(requestedUrls).toEqual([
			`https://${teamDomain}/cdn-cgi/access/certs`,
		]);
	});

	test("reads the token from the CF_Authorization cookie", async () => {
		const jwt = await signToken();
		const request = new Request("https://example.com/_emdash/admin", {
			headers: { Cookie: `theme=dark; CF_Authorization=${jwt}; other=1` },
		});

		await expect(authenticate(request, accessConfig())).resolves.toMatchObject({
			email: "editor@example.com",
			name: "editor",
		});
	});

	test("prefers the Access header over the CF_Authorization cookie", async () => {
		const headerJwt = await signToken({ email: "header@example.com" });
		const cookieJwt = await signToken({ email: "cookie@example.com" });
		const request = new Request("https://example.com/_emdash/admin", {
			headers: {
				"Cf-Access-Jwt-Assertion": headerJwt,
				Cookie: `CF_Authorization=${cookieJwt}`,
			},
		});

		await expect(authenticate(request, accessConfig())).resolves.toMatchObject({
			email: "header@example.com",
		});
	});

	test("does not fall back to the cookie when the header token is invalid", async () => {
		const headerJwt = await signToken(
			{ email: "header@example.com" },
			{ key: otherSigningKey },
		);
		const cookieJwt = await signToken({ email: "cookie@example.com" });
		const request = new Request("https://example.com/_emdash/admin", {
			headers: {
				"Cf-Access-Jwt-Assertion": headerJwt,
				Cookie: `CF_Authorization=${cookieJwt}`,
			},
		});

		await expect(authenticate(request, accessConfig())).rejects.toMatchObject({
			code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
		});
	});

	test("ignores a role claim in the token", async () => {
		const jwt = await signToken({ role: 50 });

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).resolves.toMatchObject({ role: 30 });
	});

	test("uses the configured default role", async () => {
		const jwt = await signToken();

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig({ defaultRole: 40 })),
		).resolves.toMatchObject({ role: 40 });
	});

	test.each([
		["the default env var", { audienceEnvVar: undefined }],
		["an explicit audience", { audience: AUDIENCE }],
		["a custom env var", { audienceEnvVar: "SITE_ACCESS_AUDIENCE" }],
	])(
		"rejects a token for another Access application with %s",
		async (_label, overrides) => {
			vi.stubEnv("SITE_ACCESS_AUDIENCE", AUDIENCE);
			const jwt = await signToken({}, { audience: "another-application" });

			await expect(
				authenticate(requestWithHeader(jwt), accessConfig(overrides)),
			).rejects.toMatchObject({
				code: "ERR_JWT_CLAIM_VALIDATION_FAILED",
				claim: "aud",
			});
		},
	);

	test("rejects a forged CF_Authorization cookie", async () => {
		const jwt = await signToken({}, { key: otherSigningKey });
		const request = new Request("https://example.com/_emdash/admin", {
			headers: { Cookie: `CF_Authorization=${jwt}` },
		});

		await expect(authenticate(request, accessConfig())).rejects.toMatchObject({
			code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
		});
	});

	test("rejects a token issued by another team domain", async () => {
		const jwt = await signToken(
			{},
			{ issuer: "https://other-team.cloudflareaccess.test" },
		);

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).rejects.toMatchObject({
			code: "ERR_JWT_CLAIM_VALIDATION_FAILED",
			claim: "iss",
		});
		expect(requestedUrls).toEqual([
			`https://${teamDomain}/cdn-cgi/access/certs`,
		]);
	});

	test("rejects a token whose signature does not match the team key", async () => {
		const jwt = await signToken({}, { key: otherSigningKey });

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).rejects.toMatchObject({ code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" });
	});

	test("rejects a token signed with a key the team does not publish", async () => {
		const jwt = await signToken(
			{},
			{ key: otherSigningKey, keyId: "unknown-key" },
		);

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).rejects.toMatchObject({ code: "ERR_JWKS_NO_MATCHING_KEY" });
	});

	test("rejects a symmetric HS256 token keyed with the team's public key", async () => {
		const jwt = await new SignJWT({ email: "admin@example.com" })
			.setProtectedHeader({ alg: "HS256", kid: KEY_ID })
			.setIssuer(`https://${teamDomain}`)
			.setAudience(AUDIENCE)
			.setIssuedAt()
			.setExpirationTime("5m")
			.sign(new TextEncoder().encode(publicKeyPem));

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).rejects.toSatisfy(isAlgorithmRejection);
	});

	test("rejects tokens when the team's keys cannot be fetched", async () => {
		certsResponse = () => new Response("unavailable", { status: 503 });
		const jwt = await signToken();

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).rejects.toBeInstanceOf(errors.JOSEError);
		expect(requestedUrls).toEqual([
			`https://${teamDomain}/cdn-cgi/access/certs`,
		]);
	});

	test("rejects a token with a tampered payload", async () => {
		const [header, , signature] = (await signToken()).split(".");
		const forgedPayload = Buffer.from(
			JSON.stringify({
				email: "admin@example.com",
				iss: `https://${teamDomain}`,
				aud: AUDIENCE,
				exp: Math.floor(Date.now() / 1000) + 300,
			}),
		).toString("base64url");

		await expect(
			authenticate(
				requestWithHeader(`${header}.${forgedPayload}.${signature}`),
				accessConfig(),
			),
		).rejects.toMatchObject({ code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" });
	});

	test("rejects an unsigned token", async () => {
		// Either jose code is fine: the second applies if the module later
		// restricts algorithms explicitly.
		const encode = (value: object) =>
			Buffer.from(JSON.stringify(value)).toString("base64url");
		const unsigned = `${encode({ alg: "none", kid: KEY_ID })}.${encode({
			email: "admin@example.com",
			iss: `https://${teamDomain}`,
			aud: AUDIENCE,
			exp: Math.floor(Date.now() / 1000) + 300,
		})}.`;

		await expect(
			authenticate(requestWithHeader(unsigned), accessConfig()),
		).rejects.toSatisfy(isAlgorithmRejection);
	});

	test("accepts a token that expired within the clock tolerance", async () => {
		freezeClock();
		const expiredAt = FROZEN_NOW_SECONDS - 59;
		const jwt = await signToken({}, { expiresAt: expiredAt });

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).resolves.toMatchObject({ email: "editor@example.com" });
	});

	test("rejects a token that expired beyond the clock tolerance", async () => {
		freezeClock();
		const expiredAt = FROZEN_NOW_SECONDS - 61;
		const jwt = await signToken({}, { expiresAt: expiredAt });

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).rejects.toMatchObject({ code: "ERR_JWT_EXPIRED" });
	});

	test("rejects a signed token without an expiry", async () => {
		const jwt = await signToken({}, { expiresAt: null });

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).rejects.toMatchObject({
			code: "ERR_JWT_CLAIM_VALIDATION_FAILED",
			claim: "exp",
			reason: "missing",
		});
	});

	test("accepts a token whose start time is within the clock tolerance", async () => {
		freezeClock();
		const notBefore = FROZEN_NOW_SECONDS + 59;
		const jwt = await signToken({}, { notBefore, expiresAt: notBefore + 300 });

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).resolves.toMatchObject({ email: "editor@example.com" });
	});

	test("rejects a token that is not valid yet", async () => {
		freezeClock();
		const notBefore = FROZEN_NOW_SECONDS + 61;
		const jwt = await signToken({}, { notBefore, expiresAt: notBefore + 300 });

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).rejects.toMatchObject({
			code: "ERR_JWT_CLAIM_VALIDATION_FAILED",
			claim: "nbf",
		});
	});

	test("rejects a valid token without an email claim", async () => {
		const jwt = await signToken({ email: undefined });

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).rejects.toThrow("Cloudflare Access JWT is missing an email claim");
	});

	test("rejects a request without an Access token", async () => {
		await expect(
			authenticate(
				new Request("https://example.com/_emdash/admin"),
				accessConfig(),
			),
		).rejects.toThrow("No Access JWT present");
		expect(requestedUrls).toEqual([]);
	});

	test.each([
		["unset", undefined],
		["empty", ""],
	])(
		"rejects every token when CF_ACCESS_AUDIENCE is %s",
		async (_label, value) => {
			vi.stubEnv("CF_ACCESS_AUDIENCE", value);
			const jwt = await signToken();

			await expect(
				authenticate(requestWithHeader(jwt), accessConfig()),
			).rejects.toThrow(
				'Environment variable "CF_ACCESS_AUDIENCE" not found or empty.',
			);
			expect(requestedUrls).toEqual([]);
		},
	);

	test("reads CF_ACCESS_AUDIENCE from the Workers environment", async () => {
		vi.stubEnv("CF_ACCESS_AUDIENCE", "");
		(workersEnv as Record<string, string | undefined>).CF_ACCESS_AUDIENCE =
			AUDIENCE;
		const jwt = await signToken();

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).resolves.toMatchObject({ email: "editor@example.com" });
	});

	test("prefers the process environment over the Workers environment", async () => {
		(workersEnv as Record<string, string | undefined>).CF_ACCESS_AUDIENCE =
			"another-application";
		const jwt = await signToken();

		await expect(
			authenticate(requestWithHeader(jwt), accessConfig()),
		).resolves.toMatchObject({ email: "editor@example.com" });
	});

	test("reads CF_ACCESS_AUDIENCE when no audience env var is configured", async () => {
		const jwt = await signToken();

		await expect(
			authenticate(requestWithHeader(jwt), { teamDomain }),
		).resolves.toMatchObject({ email: "editor@example.com" });
	});

	test("reads the audience from a configured env var name", async () => {
		vi.stubEnv("CF_ACCESS_AUDIENCE", "another-application");
		vi.stubEnv("SITE_ACCESS_AUDIENCE", AUDIENCE);
		const jwt = await signToken();

		await expect(
			authenticate(
				requestWithHeader(jwt),
				accessConfig({ audienceEnvVar: "SITE_ACCESS_AUDIENCE" }),
			),
		).resolves.toMatchObject({ email: "editor@example.com" });
	});

	test("does not fall back to CF_ACCESS_AUDIENCE when a configured env var is missing", async () => {
		vi.stubEnv("SITE_ACCESS_AUDIENCE", undefined);
		const jwt = await signToken();

		await expect(
			authenticate(
				requestWithHeader(jwt),
				accessConfig({ audienceEnvVar: "SITE_ACCESS_AUDIENCE" }),
			),
		).rejects.toThrow(
			'Environment variable "SITE_ACCESS_AUDIENCE" not found or empty.',
		);
	});

	test("prefers an explicit audience over the environment", async () => {
		vi.stubEnv("CF_ACCESS_AUDIENCE", "another-application");
		const jwt = await signToken();

		await expect(
			authenticate(
				requestWithHeader(jwt),
				accessConfig({ audience: AUDIENCE }),
			),
		).resolves.toMatchObject({ email: "editor@example.com" });
	});

	test.each([
		["no team domain", { audience: AUDIENCE }],
		["a non-string team domain", { teamDomain: 123, audience: AUDIENCE }],
		["no config", null],
	])("rejects a config with %s", async (_label, config) => {
		const jwt = await signToken();

		await expect(authenticate(requestWithHeader(jwt), config)).rejects.toThrow(
			"Invalid Cloudflare Access config: teamDomain is required",
		);
		expect(requestedUrls).toEqual([]);
	});

	test("reuses the team's cached keys across requests", async () => {
		const first = await signToken({ email: "first@example.com" });
		const second = await signToken({ email: "second@example.com" });

		await authenticate(requestWithHeader(first), accessConfig());
		await expect(
			authenticate(requestWithHeader(second), accessConfig()),
		).resolves.toMatchObject({ email: "second@example.com" });
		expect(requestedUrls).toEqual([
			`https://${teamDomain}/cdn-cgi/access/certs`,
		]);
	});
});
