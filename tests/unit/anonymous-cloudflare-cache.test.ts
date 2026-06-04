import { describe, expect, test } from "vitest";

import {
	hasStatefulCookie,
	isAnonymousPageCacheCandidate,
	normalizePageCacheKey,
} from "../../src/lib/anonymous-cloudflare-cache";

function request(path: string, init: RequestInit = {}) {
	return new Request(
		`https://engaged-philosophy.ramona75.workers.dev${path}`,
		init,
	);
}

describe("anonymous Cloudflare page cache", () => {
	test("accepts anonymous page GET requests", () => {
		expect(isAnonymousPageCacheCandidate(request("/about/"))).toBe(true);
		expect(
			isAnonymousPageCacheCandidate(request("/about/?utm_source=test")),
		).toBe(true);
		expect(
			normalizePageCacheKey(
				new URL("https://example.com/about/?utm_source=test&b=2&a=1"),
			),
		).toBe("https://example.com/about/?a=1&b=2");
	});

	test("rejects non-page and signed-in requests", () => {
		expect(
			isAnonymousPageCacheCandidate(request("/about/", { method: "POST" })),
		).toBe(false);
		expect(isAnonymousPageCacheCandidate(request("/_emdash/admin"))).toBe(
			false,
		);
		expect(
			isAnonymousPageCacheCandidate(request("/cdn-cgi/access/authorized")),
		).toBe(false);
		expect(isAnonymousPageCacheCandidate(request("/site.webmanifest"))).toBe(
			false,
		);
		expect(isAnonymousPageCacheCandidate(request("/?s=ethics"))).toBe(false);
		expect(
			isAnonymousPageCacheCandidate(
				request("/about/", { headers: { Cookie: "CF_Authorization=abc" } }),
			),
		).toBe(false);
		expect(
			isAnonymousPageCacheCandidate(
				request("/about/", {
					headers: { Cookie: "foo=bar; emdash-edit-mode=true" },
				}),
			),
		).toBe(false);
	});

	test("detects cookies that imply personalized state", () => {
		expect(hasStatefulCookie("CF_Authorization=abc")).toBe(true);
		expect(hasStatefulCookie("foo=bar; emdash-edit-mode=true")).toBe(true);
		expect(hasStatefulCookie("foo=bar; astro-session=abc")).toBe(true);
		expect(hasStatefulCookie("foo=bar; __em_d1_bookmark=abc")).toBe(true);
		expect(hasStatefulCookie("foo=bar; _ga=abc")).toBe(false);
	});
});
