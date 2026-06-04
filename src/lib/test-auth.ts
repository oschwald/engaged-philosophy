import type { AuthResult } from "emdash";

const TEST_AUTH_HEADER = "X-EmDash-Test-Auth";
const TEST_AUTH_EMAIL = "admin@example.test";
const TEST_AUTH_NAME = "Admin Test User";

interface TestAuthConfig {
	defaultRole?: number;
}

export async function authenticate(
	request: Request,
	config: TestAuthConfig,
): Promise<AuthResult> {
	if (request.headers.get(TEST_AUTH_HEADER) !== "1") {
		throw new Error("Missing test auth header");
	}

	return {
		email: TEST_AUTH_EMAIL,
		name: TEST_AUTH_NAME,
		role: config.defaultRole ?? 50,
		subject: "test-admin",
		metadata: { provider: "test" },
	};
}
