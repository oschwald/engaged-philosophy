import { readFile } from "node:fs/promises";
import { test, expect } from "../../fixtures/worker";
import {
	createAndPublishContentViaApi,
	expectPublicContent,
	portableTextParagraph,
	publishContentViaApi,
	updateContentViaApi,
	uploadMediaViaApi,
	uniqueTitle,
} from "../../support/content";
import { PUBLIC_MEDIA_URL } from "../../../src/lib/site-config";

const UPLOAD_FIXTURE = new URL("../../../public/img/logo.png", import.meta.url);

test.describe("public page cache", () => {
	test("caches generated metadata with its data dependencies", async ({
		publicPage,
	}) => {
		const manifestResponse = await publicPage.request.get("/site.webmanifest");
		expect(manifestResponse.headers()["cache-tag"]).toContain("site-settings");
		expect(
			manifestResponse.headers()["cloudflare-cdn-cache-control"],
		).toContain("max-age=86400");

		const faviconResponse = await publicPage.request.get("/favicon.ico", {
			maxRedirects: 0,
		});
		expect(faviconResponse.headers()["cache-tag"]).toContain("site-settings");
	});

	test("advertises the public media URL for the browser favicon", async ({
		authedRequest,
		publicPage,
	}, testInfo) => {
		const filename = `e2e-favicon-${testInfo.workerIndex}-${Date.now()}.png`;
		const media = await uploadMediaViaApi(authedRequest, {
			filename,
			mimeType: "image/png",
			buffer: await readFile(UPLOAD_FIXTURE),
			width: 481,
			height: 102,
		});
		expect(media.storageKey).toBeTruthy();

		try {
			const settingsResponse = await authedRequest.post(
				"/_emdash/api/settings",
				{
					data: {
						favicon: { mediaId: media.id },
					},
				},
			);
			expect(settingsResponse.ok()).toBe(true);

			const pageResponse = await publicPage.request.get("/");
			const html = await pageResponse.text();
			const publicHref = `${PUBLIC_MEDIA_URL}/${media.storageKey}`;
			const internalHref = `/_emdash/api/media/file/${media.storageKey}`;

			expect(html).toContain(`href="${internalHref}"`);
			expect(html).toContain(
				`href="${publicHref}" type="image/png" sizes="481x102"`,
			);
			expect(html.indexOf(`href="${publicHref}"`)).toBeGreaterThan(
				html.indexOf(`href="${internalHref}"`),
			);
		} finally {
			const deleteResponse = await authedRequest.delete(
				`/_emdash/api/media/${media.id}`,
			);
			expect(deleteResponse.ok()).toBe(true);
		}
	});

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
			).toContain("max-age=86400");
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
