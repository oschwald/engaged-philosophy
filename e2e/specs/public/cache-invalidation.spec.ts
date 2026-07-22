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
	test("keeps stateful and query-string HTML out of the shared cache", async ({
		publicPage,
	}) => {
		const anonymousResponse = await publicPage.request.get("/");
		expect(anonymousResponse.headers()["vary"]).toContain("Cookie");
		expect(anonymousResponse.headers()["cache-control"]).toBe(
			"public, max-age=0, must-revalidate",
		);
		expect(anonymousResponse.headers()["cache-tag"]).toContain("site-settings");
		expect(anonymousResponse.headers()["cache-tag"]).toContain("menu:primary");

		await publicPage.context().addCookies([
			{
				name: "analytics",
				value: "enabled",
				url: new URL(anonymousResponse.url()).origin,
			},
		]);
		const cookieResponse = await publicPage.request.get("/");
		expect(cookieResponse.headers()["cloudflare-cdn-cache-control"]).toBe(
			"no-store",
		);
		await publicPage.context().clearCookies();

		const queryResponse = await publicPage.request.get("/?preview=1");
		expect(queryResponse.headers()["cloudflare-cdn-cache-control"]).toBe(
			"no-store",
		);
	});

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
		const primedCacheStatus = cachedResponse?.headers()["cf-cache-status"];
		if (primedCacheStatus) {
			expect(primedCacheStatus).toMatch(/^(HIT|MISS|STALE|UPDATING)$/);
		} else {
			expect(
				cachedResponse?.headers()["cloudflare-cdn-cache-control"],
			).toContain("max-age=300");
		}

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
			expect(refreshedResponse?.headers()["cf-cache-status"]).not.toBe("HIT");
		}
		await expect(publicPage.getByText(updatedText)).toBeVisible();
		await expect(publicPage.getByText(initialText)).toHaveCount(0);
	});
});
