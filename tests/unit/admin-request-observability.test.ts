import { describe, expect, test } from "vitest";

import { getObservedRequestInfo } from "../../src/lib/admin-request-observability";

function request(path: string, cookie = "") {
	return new Request(`https://example.com${path}`, {
		headers: cookie ? { Cookie: cookie } : {},
	});
}

describe("admin request observability", () => {
	test("ignores ordinary anonymous public requests", () => {
		expect(getObservedRequestInfo(request("/about/"), "req-public")).toBeNull();
	});

	test("records admin route metadata without sensitive values", () => {
		const adminInfo = getObservedRequestInfo(
			request("/_emdash/admin?redirect=/about/&nonce=secret"),
			"req-admin",
		);

		expect(adminInfo).toMatchObject({
			requestId: "req-admin",
			path: "/_emdash/admin",
			queryKeys: ["nonce", "redirect"],
			reasons: ["emdash-route"],
		});
	});

	test("records signed-in request flags without serializing secrets", () => {
		const signedInInfo = getObservedRequestInfo(
			request(
				"/about/?draft=true",
				"astro-session=session-secret; CF_Authorization=jwt-secret; emdash-edit-mode=true; __em_d1_bookmark=bookmark-secret",
			),
			"req-signed-in",
		);

		expect(signedInInfo).toMatchObject({
			path: "/about/",
			queryKeys: ["draft"],
			cookieFlags: {
				astroSession: true,
				cloudflareAccess: true,
				editMode: true,
				d1Bookmark: true,
			},
		});

		const serialized = JSON.stringify(signedInInfo);
		expect(serialized).not.toContain("session-secret");
		expect(serialized).not.toContain("jwt-secret");
		expect(serialized).not.toContain("bookmark-secret");
	});
});
