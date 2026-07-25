import { test, expect } from "../../fixtures/worker";
import {
	createAndPublishContentViaApi,
	deleteContentViaApi,
	uniqueTitle,
} from "../../support/content";

test("serves published posts through the legacy RSS feed URL", async ({
	authedRequest,
	publicPage,
}, testInfo) => {
	const title = uniqueTitle("E2E RSS Post", testInfo.testId);
	const description = "A feed summary generated from portable text.";
	const { created, publicPath } = await createAndPublishContentViaApi(
		authedRequest,
		"posts",
		{
			title,
			content: description,
			publishedAt: "2026-07-25T12:00:00Z",
		},
	);

	try {
		const response = await publicPage.goto("/feed/");
		expect(response?.status()).toBe(200);
		expect(response?.headers()["content-type"]).toContain(
			"application/rss+xml",
		);
		expect(response?.headers()["cache-tag"]).toContain("site-settings");
		expect(response?.headers()["cache-tag"]).toContain("posts");
		expect(response?.headers()["cloudflare-cdn-cache-control"]).toContain(
			"max-age=86400",
		);

		const xml = await response!.text();
		expect(xml).toContain("<rss");
		expect(xml).toContain(`<title>${title}</title>`);
		expect(xml).toContain(
			`<link>https://www.engagedphilosophy.com${publicPath}</link>`,
		);
		expect(xml).toContain(`<description>${description}</description>`);
	} finally {
		await deleteContentViaApi(authedRequest, "posts", created.id);
	}
});
