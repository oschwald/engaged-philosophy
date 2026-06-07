import { env as cloudflareEnv } from "cloudflare:workers";
import type { AuthResult } from "emdash";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

interface AccessConfig {
	teamDomain: string;
	audience?: string;
	audienceEnvVar?: string;
	defaultRole?: number;
}

interface AccessJwtPayload extends JWTPayload {
	email?: string;
	name?: string;
}

const DEFAULT_AUDIENCE_ENV_VAR = "CF_ACCESS_AUDIENCE";
const CF_AUTHORIZATION_COOKIE_REGEX = /CF_Authorization=([^;]+)/;
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(teamDomain: string) {
	let jwks = jwksCache.get(teamDomain);
	if (!jwks) {
		jwks = createRemoteJWKSet(
			new URL(`https://${teamDomain}/cdn-cgi/access/certs`),
		);
		jwksCache.set(teamDomain, jwks);
	}
	return jwks;
}

function getRuntimeEnv(name: string) {
	const processValue =
		typeof process !== "undefined" ? process.env?.[name] : undefined;
	if (processValue) return processValue;

	return (cloudflareEnv as Record<string, string | undefined>)[name];
}

function resolveAudience(config: AccessConfig) {
	if (config.audience) return config.audience;

	const name = config.audienceEnvVar ?? DEFAULT_AUDIENCE_ENV_VAR;
	const value = getRuntimeEnv(name);
	if (value) return value;

	throw new Error(`Environment variable "${name}" not found or empty.`);
}

function extractAccessJwt(request: Request) {
	const headerJwt = request.headers.get("Cf-Access-Jwt-Assertion");
	if (headerJwt) return headerJwt;

	const cookies = request.headers.get("Cookie") || "";
	return cookies.match(CF_AUTHORIZATION_COOKIE_REGEX)?.[1] || null;
}

function isAccessConfig(value: unknown): value is AccessConfig {
	return (
		value != null &&
		typeof value === "object" &&
		"teamDomain" in value &&
		typeof value.teamDomain === "string"
	);
}

export async function authenticate(
	request: Request,
	config: unknown,
): Promise<AuthResult> {
	if (!isAccessConfig(config)) {
		throw new Error("Invalid Cloudflare Access config: teamDomain is required");
	}

	const jwt = extractAccessJwt(request);
	if (!jwt) throw new Error("No Access JWT present");

	const { payload } = await jwtVerify<AccessJwtPayload>(
		jwt,
		getJwks(config.teamDomain),
		{
			issuer: `https://${config.teamDomain}`,
			audience: resolveAudience(config),
			clockTolerance: 60,
		},
	);

	if (!payload.email) {
		throw new Error("Cloudflare Access JWT is missing an email claim");
	}

	return {
		email: payload.email,
		name: payload.name ?? payload.email.split("@")[0] ?? "Unknown",
		role: config.defaultRole ?? 30,
		subject: payload.sub,
		metadata: {
			groups: [],
			idp: undefined,
		},
	};
}
