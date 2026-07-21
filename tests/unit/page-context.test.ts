import { describe, expect, test } from "vitest";

import { createSitePageContext } from "../../src/lib/page-context";
import type { ContentEntry, PostData } from "../../src/lib/types";

function postEntry(data: PostData): ContentEntry<PostData> {
	return {
		id: "post-row-id",
		data,
		edit: {} as ContentEntry<PostData>["edit"],
	};
}

describe("site page context", () => {
	test("builds canonical metadata for custom pages", () => {
		const page = createSitePageContext({
			url: new URL("https://worker.example/blog/?utm_source=test"),
			siteTitle: "Engaged Philosophy",
			siteDescription: "Philosophy in practice",
			siteUrl: "https://www.example.com/",
			title: "Blog",
		});

		expect(page).toMatchObject({
			title: "Blog – Engaged Philosophy",
			description: "Philosophy in practice",
			canonical: "https://www.example.com/blog/",
			pageType: "website",
			siteUrl: "https://www.example.com",
		});
	});

	test("keeps the full site title on the homepage", () => {
		const page = createSitePageContext({
			url: new URL("https://www.example.com/"),
			siteTitle: "Engaged Philosophy",
			siteDescription: "Philosophy in practice",
			title: "Home",
		});

		expect(page.title).toBe("Engaged Philosophy – Philosophy in practice");
	});

	test("uses EmDash SEO fields and legacy publication metadata", () => {
		const entry = postEntry({
			id: "content-id",
			slug: "an-essay",
			title: "An essay",
			published_on: "2026-07-01T10:00:00Z",
			updatedAt: "2026-07-02T11:00:00Z",
			author_name: "A. Philosopher",
			seo: {
				title: "A better title",
				description: "A concise description",
				image: "/media/essay.jpg",
				canonical: "/essays/canonical/",
				noIndex: true,
			},
		});
		const page = createSitePageContext({
			url: new URL("https://worker.example/2026/07/01/an-essay/"),
			siteTitle: "Engaged Philosophy",
			siteDescription: "Philosophy in practice",
			siteUrl: "https://www.example.com",
			title: entry.data.title,
			content: { collection: "posts", entry },
		});

		expect(page).toMatchObject({
			title: "A better title – Engaged Philosophy",
			description: "A concise description",
			canonical: "https://www.example.com/essays/canonical/",
			image: "https://www.example.com/media/essay.jpg",
			pageType: "article",
			content: {
				collection: "posts",
				id: "content-id",
				slug: "an-essay",
			},
			seo: { robots: "noindex, nofollow" },
			articleMeta: {
				publishedTime: "2026-07-01T10:00:00.000Z",
				modifiedTime: "2026-07-02T11:00:00.000Z",
				author: "A. Philosopher",
			},
		});
	});
});
