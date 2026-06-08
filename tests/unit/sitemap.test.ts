import { describe, expect, test } from "vitest";

import {
	renderSitemapXml,
	sitemapEntryLastmod,
	sitemapPathToUrl,
} from "../../src/lib/sitemap";

describe("sitemap helpers", () => {
	test("builds canonical URLs from migrated content paths", () => {
		expect(sitemapPathToUrl("https://www.engagedphilosophy.com/", "")).toBe(
			"https://www.engagedphilosophy.com/",
		);
		expect(
			sitemapPathToUrl(
				"https://www.engagedphilosophy.com",
				"2022/05/31/jason-swartwood",
			),
		).toBe("https://www.engagedphilosophy.com/2022/05/31/jason-swartwood/");
		expect(
			sitemapPathToUrl("https://www.engagedphilosophy.com", " about/ "),
		).toBe("https://www.engagedphilosophy.com/about/");
	});

	test("uses the best available timestamp for lastmod", () => {
		expect(
			sitemapEntryLastmod({
				id: "post",
				updatedAt: new Date("2026-06-07T00:00:00Z"),
				data: {
					path: "2022/05/31/jason-swartwood",
					published_on: "2022-06-01T00:12:21Z",
				},
			}),
		).toBe("2026-06-07T00:00:00.000Z");

		expect(
			sitemapEntryLastmod({
				id: "page",
				data: {
					path: "about",
					updatedAt: new Date("2026-06-07T00:00:00Z"),
				},
			}),
		).toBe("2026-06-07T00:00:00.000Z");
	});

	test("renders unique XML sitemap URLs with escaped values", () => {
		const xml = renderSitemapXml("https://www.engagedphilosophy.com", [
			{
				id: "home",
				data: { path: "", updated_at: "2026-06-07T00:00:00Z" },
			},
			{
				id: "project",
				data: {
					path: "project/a-b",
					updated_at: "2026-06-07T00:00:00Z",
				},
			},
			{
				id: "duplicate",
				data: {
					path: "project/a-b",
					updated_at: "2026-06-08T00:00:00Z",
				},
			},
		]);

		expect(xml).toContain("<urlset");
		expect(xml.match(/<url>/g)).toHaveLength(2);
		expect(xml).toContain(
			[
				"<loc>https://www.engagedphilosophy.com/project/a-b/</loc>",
				"<lastmod>2026-06-08T00:00:00Z</lastmod>",
			].join("\n    "),
		);
		expect(xml).toContain("<lastmod>2026-06-07T00:00:00Z</lastmod>");
	});
});
