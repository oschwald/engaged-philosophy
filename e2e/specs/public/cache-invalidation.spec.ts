import { test, expect } from "../../fixtures/worker";
import {
	createAndPublishContentViaApi,
	expectPublicContent,
	portableTextParagraph,
	publishContentViaApi,
	updateContentViaApi,
	uniqueTitle,
} from "../../support/content";

test.describe("public page cache", () => {
	test("refreshes anonymous cached HTML after publishing an edit", async ({
		authedRequest,
		publicPage,
	}, testInfo) => {
		const title = uniqueTitle("E2E Cache Invalidation", testInfo.testId);
		const initialText = `${title} initial public body.`;
		const updatedText = `${title} updated public body.`;

		const { published, publicPath } = await createAndPublishContentViaApi(
			authedRequest,
			"pages",
			{
				title,
				content: initialText,
			},
		);

		await expectPublicContent(publicPage, publicPath, title, initialText);
		const cachedResponse = await publicPage.goto(publicPath, {
			waitUntil: "domcontentloaded",
		});
		const primedCacheStatus = cachedResponse?.headers()["x-ep-cache"];
		expect(primedCacheStatus).toMatch(/^(HIT|MISS|STALE)$/);

		await updateContentViaApi(authedRequest, "pages", published.id, {
			data: {
				content: portableTextParagraph(updatedText),
			},
		});
		await publishContentViaApi(authedRequest, "pages", published.id);

		const refreshedResponse = await publicPage.goto(publicPath, {
			waitUntil: "domcontentloaded",
		});
		if (primedCacheStatus === "HIT") {
			expect(refreshedResponse?.headers()["x-ep-cache"]).toBe("MISS");
		}
		await expect(publicPage.getByText(updatedText)).toBeVisible();
		await expect(publicPage.getByText(initialText)).toHaveCount(0);
	});
});
