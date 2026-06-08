import { describe, expect, test } from "vitest";

import {
	createFaviconResponse,
	getConfiguredFaviconHref,
} from "../../src/lib/favicon";

const FAVICON_CACHE_CONTROL =
	"public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

describe("favicon helpers", () => {
	test("rewrites configured EmDash media file URLs", () => {
		expect(
			getConfiguredFaviconHref(
				{
					favicon: {
						url: "/_emdash/api/media/file/01KSKNR8NPBFJAV6X4SW70KADX.png",
					},
				},
				"https://media.example",
			),
		).toBe("https://media.example/01KSKNR8NPBFJAV6X4SW70KADX.png");
	});

	test("redirects the SVG compatibility path to the configured favicon", () => {
		const response = createFaviconResponse(
			{
				favicon: {
					url: "/_emdash/api/media/file/01KSKNR8NPBFJAV6X4SW70KADX.png",
				},
			},
			{
				mediaUrlPrefix: "https://media.example",
				requestUrl: "https://www.example.test/favicon.svg",
			},
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			"https://media.example/01KSKNR8NPBFJAV6X4SW70KADX.png",
		);
		expect(response.headers.get("cache-control")).toBe(FAVICON_CACHE_CONTROL);
	});

	test("does not serve an SVG fallback when no favicon is configured", () => {
		const response = createFaviconResponse(null);

		expect(response.status).toBe(404);
		expect(response.headers.has("location")).toBe(false);
		expect(response.headers.get("cache-control")).toBe(FAVICON_CACHE_CONTROL);
	});

	test("redirects absolute configured media favicon URLs unchanged", () => {
		const response = createFaviconResponse(
			{
				favicon: {
					url: "https://media.example/favicon.png",
				},
			},
			{ mediaUrlPrefix: "https://media.example" },
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			"https://media.example/favicon.png",
		);
	});

	test("allows root-relative non-compatibility favicon URLs", () => {
		expect(
			getConfiguredFaviconHref(
				{
					favicon: {
						url: "/assets/favicon.png",
					},
				},
				"https://media.example",
			),
		).toBe("/assets/favicon.png");
	});

	test("does not redirect to compatibility favicon paths", () => {
		const response = createFaviconResponse(
			{
				favicon: {
					url: "/favicon.ico",
				},
			},
			{
				mediaUrlPrefix: "https://media.example",
				requestUrl: "https://www.example.test/favicon.ico",
			},
		);

		expect(response.status).toBe(404);
		expect(response.headers.has("location")).toBe(false);
	});

	test("does not redirect to the same request target", () => {
		const response = createFaviconResponse(
			{
				favicon: {
					url: "https://www.example.test/favicon.svg",
				},
			},
			{
				mediaUrlPrefix: "https://www.example.test",
				requestUrl: "https://www.example.test/favicon.svg",
			},
		);

		expect(response.status).toBe(404);
		expect(response.headers.has("location")).toBe(false);
	});

	test("rejects unsafe configured favicon URLs", () => {
		for (const url of [
			"https://attacker.example/favicon.png",
			"//attacker.example/favicon.png",
			"javascript:alert(1)",
			"http://media.example/favicon.png",
		]) {
			expect(
				getConfiguredFaviconHref(
					{
						favicon: {
							url,
						},
					},
					"https://media.example",
				),
			).toBe("");
		}
	});
});
