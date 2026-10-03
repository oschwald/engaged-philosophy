import { describe, expect, test } from "vitest";

import {
	renderSitemapXml,
	sitemapEntryLastmod,
	sitemapPathToUrl,
} from "../../src/lib/sitemap";

describe("sitemap helpers", () => {
	test("builds canonical URLs from migrated content paths", () => {
		expect(sitemapPathToUrl("")).toBe("https://www.engagedphilosophy.com/");
		expect(sitemapPathToUrl("2022/05/31/jason-swartwood")).toBe(
			"https://www.engagedphilosophy.com/2022/05/31/jason-swartwood/",
		);
		expect(sitemapPathToUrl(" about/ ")).toBe(
			"https://www.engagedphilosophy.com/about/",
		);
	});

	test("uses the best available timestamp for lastmod", () => {
		expect(
			sitemapEntryLastmod({
				id: "post",
				data: {
					path: "2022/05/31/jason-swartwood",
					updatedAt: new Date("2026-06-07T00:00:00Z"),
					publishedAt: new Date("2022-06-01T00:12:21Z"),
				},
			}),
		).toBe("2026-06-07T00:00:00.000Z");

		expect(
			sitemapEntryLastmod({
				id: "page",
				data: {
					path: "about",
					publishedAt: new Date("2022-06-01T00:12:21Z"),
				},
			}),
		).toBe("2022-06-01T00:12:21.000Z");
	});

	test("renders unique XML sitemap URLs with escaped values", () => {
		const xml = renderSitemapXml([
			{
				id: "home",
				data: { path: "", updatedAt: "2026-06-07T00:00:00Z" },
			},
			{
				id: "project",
				image: "https://media.example/project&image.jpg",
				data: {
					path: "project/a-b",
					updatedAt: "2026-06-07T00:00:00Z",
				},
			},
			{
				id: "duplicate",
				data: {
					path: "project/a-b",
					updatedAt: "2026-06-08T00:00:00Z",
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
		expect(xml).toContain(
			"<image:loc>https://media.example/project&amp;image.jpg</image:loc>",
		);
	});

	test("honors EmDash indexing and canonical settings", () => {
		const xml = renderSitemapXml([
			{
				id: "canonical",
				data: {
					path: "old-path",
					seo: { canonical: "/preferred" },
				},
			},
			{
				id: "canonical-duplicate",
				data: { path: "preferred" },
			},
			{
				id: "noindex",
				data: {
					path: "private",
					seo: { noIndex: true },
				},
			},
			{
				id: "external-canonical",
				data: {
					path: "duplicate",
					seo: { canonical: "https://elsewhere.example/original/" },
				},
			},
		]);

		expect(xml).toContain(
			"<loc>https://www.engagedphilosophy.com/preferred/</loc>",
		);
		expect(xml).not.toContain("private");
		expect(xml).not.toContain("duplicate");
		expect(xml.match(/<url>/g)).toHaveLength(1);
	});
});
