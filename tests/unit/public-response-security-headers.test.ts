import { describe, expect, test } from "vitest";

import { applySecurityHeaders } from "../../src/lib/security-headers";

function htmlResponse(headers: HeadersInit = {}) {
	return new Response("<!doctype html>", {
		headers: {
			"content-type": "text/html; charset=utf-8",
			...headers,
		},
	});
}

describe("Worker security headers", () => {
	test("adds CSP and HSTS to public HTTPS HTML responses", () => {
		const response = applySecurityHeaders(
			new Request("https://www.engagedphilosophy.com/about/"),
			htmlResponse(),
		);

		expect(response.headers.get("content-security-policy")).toContain(
			"script-src 'self' https://www.youtube.com",
		);
		expect(response.headers.get("content-security-policy")).toContain(
			"style-src 'self'",
		);
		expect(response.headers.get("content-security-policy")).toContain(
			"frame-src 'self' https://animoto.com https://player.vimeo.com",
		);
		expect(response.headers.get("strict-transport-security")).toBe(
			"max-age=31536000; includeSubDomains",
		);
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("referrer-policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		expect(response.headers.get("permissions-policy")).toBe(
			"camera=(), microphone=(), geolocation=(), payment=()",
		);
		expect(response.headers.get("vary")).toBe("Cookie");
	});

	test("preserves existing variance for public HTML", () => {
		const response = applySecurityHeaders(
			new Request("https://www.engagedphilosophy.com/about/"),
			htmlResponse({ vary: "Accept-Encoding" }),
		);

		expect(response.headers.get("vary")).toBe("Accept-Encoding, Cookie");
	});

	test("bypasses the edge cache for stateful and query variants", () => {
		for (const request of [
			new Request("https://www.engagedphilosophy.com/about/", {
				headers: { cookie: "CF_Authorization=abc" },
			}),
			new Request("https://www.engagedphilosophy.com/about/", {
				headers: { "cf-access-jwt-assertion": "jwt" },
			}),
			new Request("https://www.engagedphilosophy.com/about/?utm_source=test"),
		]) {
			const response = applySecurityHeaders(request, htmlResponse());
			expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
				"no-store",
			);
		}
	});

	test("does not replace existing security headers", () => {
		const response = applySecurityHeaders(
			new Request("https://www.engagedphilosophy.com/about/"),
			htmlResponse({
				"content-security-policy": "default-src 'none'",
				"referrer-policy": "same-origin",
			}),
		);

		expect(response.headers.get("content-security-policy")).toBe(
			"default-src 'none'",
		);
		expect(response.headers.get("referrer-policy")).toBe("same-origin");
	});

	test("sets an editing-compatible CSP for signed-in public editing responses", () => {
		const response = applySecurityHeaders(
			new Request("https://www.engagedphilosophy.com/about/", {
				headers: { cookie: "CF_Authorization=abc; emdash-edit-mode=true" },
			}),
			htmlResponse(),
		);

		expect(response.headers.get("content-security-policy")).toContain(
			"script-src 'self' 'unsafe-inline' https://www.youtube.com",
		);
		expect(response.headers.get("content-security-policy")).toContain(
			"style-src 'self' 'unsafe-inline'",
		);
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	});

	test("leaves EmDash admin CSP ownership to EmDash", () => {
		const response = applySecurityHeaders(
			new Request("https://www.engagedphilosophy.com/_emdash/admin"),
			htmlResponse(),
		);

		expect(response.headers.has("content-security-policy")).toBe(false);
		expect(response.headers.get("strict-transport-security")).toBe(
			"max-age=31536000; includeSubDomains",
		);
	});

	test("does not set HSTS for local HTTP development", () => {
		const response = applySecurityHeaders(
			new Request("http://127.0.0.1:4321/about/"),
			htmlResponse(),
		);

		expect(response.headers.has("strict-transport-security")).toBe(false);
	});
});
