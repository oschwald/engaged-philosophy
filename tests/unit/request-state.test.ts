import { describe, expect, test } from "vitest";

import { hasStatefulCookie } from "../../src/lib/request-state";

describe("request state", () => {
	test("detects cookies that imply personalized state", () => {
		expect(hasStatefulCookie("CF_Authorization=abc")).toBe(true);
		expect(hasStatefulCookie("foo=bar; emdash-edit-mode=true")).toBe(true);
		expect(hasStatefulCookie("foo=bar; astro-session=abc")).toBe(true);
		expect(hasStatefulCookie("foo=bar; __em_d1_bookmark=abc")).toBe(true);
		expect(hasStatefulCookie("foo=bar; _ga=abc")).toBe(false);
	});
});
