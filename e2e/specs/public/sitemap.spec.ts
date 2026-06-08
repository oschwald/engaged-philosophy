import { test, expect } from "../../fixtures/worker";
import {
	createAndPublishContentViaApi,
	uniqueTitle,
} from "../../support/content";

function parseLocations(xml: string) {
	return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(
		(match) => match[1] ?? "",
	);
}

function parseLocationPaths(xml: string) {
	return parseLocations(xml).map((location) => {
		try {
			return new URL(location).pathname;
		} catch {
			throw new Error(`Invalid sitemap URL: ${location}`);
		}
	});
}

test.describe("public sitemap", () => {
	test("lists published content at public WordPress-compatible paths", async ({
		authedRequest,
		publicPage,
	}, testInfo) => {
		const pageTitle = uniqueTitle("E2E Sitemap Page", testInfo.testId);
		const postTitle = uniqueTitle("E2E Sitemap Post", testInfo.testId);
		const postSlug = `e2e-sitemap-${testInfo.testId}`
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 48);
		const publishedAt = "2022-05-31T12:00:00Z";

		const { publicPath: pagePath } = await createAndPublishContentViaApi(
			authedRequest,
			"pages",
			{
				title: pageTitle,
			},
		);
		const { publicPath: postPath } = await createAndPublishContentViaApi(
			authedRequest,
			"posts",
			{
				title: postTitle,
				slug: postSlug,
				publishedAt,
			},
		);

		const response = await publicPage.goto("/sitemap.xml");
		expect(response?.status()).toBe(200);
		expect(response?.headers()["content-type"]).toContain("application/xml");

		const xml = await response!.text();
		const locationPaths = parseLocationPaths(xml);

		expect(locationPaths).toContain(pagePath);
		expect(locationPaths).toContain(postPath);
		expect(locationPaths).not.toContain(`/posts/${postSlug}/`);
		expect(xml).toContain("<urlset");
	});
});
