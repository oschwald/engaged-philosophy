import { describe, expect, test } from "vitest";

import { serializeHeadersForSandbox } from "../../src/plugins/audit-log";

describe("audit log plugin adapter", () => {
	test("does not expose credentials to sandbox-style route handlers", () => {
		const headers = serializeHeadersForSandbox(
			new Headers({
				authorization: "Bearer secret",
				"cf-access-client-id": "client-id",
				"cf-access-client-secret": "client-secret",
				"cf-access-jwt-assertion": "jwt",
				cookie: "astro-session=secret",
				"proxy-authorization": "Basic secret",
				"set-cookie": "astro-session=secret",
				"user-agent": "test-agent",
				"x-emdash-request": "1",
			}),
		);

		expect(headers).toEqual({ "user-agent": "test-agent" });
	});
});
