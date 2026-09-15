import { test, expect } from "../../fixtures/worker";
import {
	createAndPublishContentViaApi,
	publishContentViaApi,
	uniqueTitle,
} from "../../support/content";

test("keeps the SEO panel, document title, and structured data in agreement", async ({
	authedRequest,
	publicPage,
}, testInfo) => {
	const schemaPath = "/_emdash/api/schema/collections/posts";
	const enableSeo = await authedRequest.put(schemaPath, {
		data: { hasSeo: true },
	});
	expect(enableSeo.ok(), await enableSeo.text()).toBe(true);
	try {
		const title = uniqueTitle("E2E SEO Metadata", testInfo.testId);
		const { publicPath, published } = await createAndPublishContentViaApi(
			authedRequest,
			"posts",
			{ title, publishedAt: "2022-05-31T12:00:00Z" },
		);
		const seoTitle = `${title} panel title`;
		const description = "An editor-provided description.";
		const canonical = `https://www.engagedphilosophy.com${publicPath}`;
		const image = "//media.engagedphilosophy.com/seo-image.jpg";
		const update = await authedRequest.put(
			`/_emdash/api/content/posts/${published.id}`,
			{
				data: {
					seo: {
						title: seoTitle,
						description,
						canonical,
						image,
						noIndex: true,
					},
				},
			},
		);
		expect(update.ok(), await update.text()).toBe(true);
		await publishContentViaApi(authedRequest, "posts", published.id);

		for (let visit = 0; visit < 2; visit++) {
			await publicPage.goto(publicPath, { waitUntil: "domcontentloaded" });
			await expect(publicPage).toHaveTitle(`${seoTitle} – Engaged Philosophy`);
			await expect(
				publicPage.locator('meta[name="description"]'),
			).toHaveAttribute("content", description);
			await expect(
				publicPage.locator('meta[property="og:title"]'),
			).toHaveAttribute("content", seoTitle);
			await expect(
				publicPage.locator('meta[property="og:image"]'),
			).toHaveAttribute("content", image);
			await expect(publicPage.locator('link[rel="canonical"]')).toHaveAttribute(
				"href",
				canonical,
			);
			await expect(publicPage.locator('meta[name="robots"]')).toHaveAttribute(
				"content",
				"noindex, nofollow",
			);
			const graphs = await publicPage
				.locator('script[type="application/ld+json"]')
				.allTextContents();
			expect(graphs.map((graph) => JSON.parse(graph))).toContainEqual(
				expect.objectContaining({
					"@type": "BlogPosting",
					headline: seoTitle,
					description,
				}),
			);
		}
	} finally {
		const restore = await authedRequest.put(schemaPath, {
			data: { hasSeo: false },
		});
		expect(restore.ok(), await restore.text()).toBe(true);
	}
});
