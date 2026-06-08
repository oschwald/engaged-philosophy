import { describe, expect, test } from "vitest";

import {
	createFaviconResponse,
	getConfiguredFaviconHref,
} from "../../src/lib/favicon";

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
			"https://media.example",
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			"https://media.example/01KSKNR8NPBFJAV6X4SW70KADX.png",
		);
		expect(response.headers.get("cache-control")).toBe("no-cache");
	});

	test("does not serve an SVG fallback when no favicon is configured", () => {
		const response = createFaviconResponse(null);

		expect(response.status).toBe(404);
		expect(response.headers.has("location")).toBe(false);
	});

	test("redirects absolute configured favicon URLs unchanged", () => {
		const response = createFaviconResponse(
			{
				favicon: {
					url: "https://media.example/favicon.png",
				},
			},
			"https://media.example",
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			"https://media.example/favicon.png",
		);
	});
});
