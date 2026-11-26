import { test, expect } from "../../fixtures/worker";
import {
	createAndPublishContentViaApi,
	deleteContentViaApi,
	uniqueTitle,
} from "../../support/content";

test("serves a post at one canonical trailing-slash URL", async ({
	authedRequest,
	publicPage,
}, testInfo) => {
	const title = uniqueTitle("E2E Trailing Slash", testInfo.testId);
	const { created, publicPath } = await createAndPublishContentViaApi(
		authedRequest,
		"posts",
		{ title, publishedAt: "2026-07-25T12:00:00Z" },
	);

	try {
		expect(publicPath).toMatch(/\/$/);
		const withoutSlash = publicPath.slice(0, -1);
		const redirect = await publicPage.request.get(withoutSlash, {
			maxRedirects: 0,
		});
		expect(redirect.status()).toBe(301);
		expect(redirect.headers().location).toBe(publicPath);
		// The redirect is answered before Astro or EmDash run.
		expect(redirect.headers()["server-timing"]).toBeUndefined();

		for (const path of [withoutSlash, publicPath]) {
			const response = await publicPage.goto(path, {
				waitUntil: "domcontentloaded",
			});
			expect(response?.status(), path).toBe(200);
			expect(new URL(publicPage.url()).pathname, path).toBe(publicPath);
			await expect(
				publicPage.locator('link[rel="canonical"]'),
				path,
			).toHaveAttribute(
				"href",
				`https://www.engagedphilosophy.com${publicPath}`,
			);
		}
	} finally {
		await deleteContentViaApi(authedRequest, "posts", created.id);
	}
});
