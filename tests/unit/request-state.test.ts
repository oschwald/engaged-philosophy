import { describe, expect, test } from "vitest";

import {
	hasStatefulCookie,
	isStatefulRequest,
} from "../../src/lib/request-state";

describe("request state", () => {
	test("detects cookies that imply personalized state", () => {
		expect(hasStatefulCookie("CF_Authorization=abc")).toBe(true);
		expect(hasStatefulCookie("foo=bar; emdash-edit-mode=true")).toBe(true);
		expect(hasStatefulCookie("foo=bar; astro-session=abc")).toBe(true);
		expect(hasStatefulCookie("foo=bar; __em_d1_bookmark=abc")).toBe(true);
		expect(hasStatefulCookie("foo=bar; _ga=abc")).toBe(false);
	});

	test("detects stateful requests without treating arbitrary cookies as state", () => {
		expect(
			isStatefulRequest(
				new Request("https://example.com", {
					headers: { cookie: "analytics=value" },
				}),
			),
		).toBe(false);
		expect(
			isStatefulRequest(
				new Request("https://example.com", {
					headers: { "cf-access-jwt-assertion": "jwt" },
				}),
			),
		).toBe(true);
	});
});
