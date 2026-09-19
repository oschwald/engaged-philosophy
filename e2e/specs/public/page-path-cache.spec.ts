import { test, expect } from "../../fixtures/worker";
import { measureMissingPaths } from "../../support/cache-usage";
import {
	createContentViaApi,
	deleteContentViaApi,
	dismissWelcome,
	getPreviewUrlViaApi,
	publishContentViaApi,
	uniqueTitle,
	updateContentViaApi,
} from "../../support/content";

test("bounds KV growth for distinct missing nested pages", async ({
	workerServer,
}) => {
	test.setTimeout(120_000);
	const measurement = await measureMissingPaths(workerServer);
	expect(measurement.addedKeys).toEqual([]);
});

test("refreshes a cached missing path through publication, rename, unpublish, and deletion", async ({
	authedRequest,
	publicPage,
}, testInfo) => {
	const slug = `nested-${Date.now()}`;
	const path = `/cache-tests/nested/${slug}/`;
	const title = uniqueTitle("E2E Nested Cache", testInfo.testId);
	const missing = await publicPage.request.get(path);
	expect(missing.status()).toBe(404);
	expect(missing.headers()["cache-tag"]).toContain("pages");
	const created = await createContentViaApi(authedRequest, "pages", {
		title,
		slug,
		data: { path: `cache-tests/nested/${slug}` },
	});
	let deleted = false;
	try {
		expect((await publicPage.request.get(path)).status()).toBe(404);
		await publishContentViaApi(authedRequest, "pages", created.id);
		const published = await publicPage.request.get(path);
		expect(published.status()).toBe(200);
		expect(await published.text()).toContain(title);

		const renamed = `${slug}-renamed`;
		const renamedPath = `/cache-tests/nested/${renamed}/`;
		await updateContentViaApi(authedRequest, "pages", created.id, {
			slug: renamed,
		});
		await publishContentViaApi(authedRequest, "pages", created.id);
		expect((await publicPage.request.get(renamedPath)).status()).toBe(200);
		const oldPath = await publicPage.request.get(path, { maxRedirects: 0 });
		expect([301, 302]).toContain(oldPath.status());
		expect(oldPath.headers().location).toBe(renamedPath);

		const unpublished = await authedRequest.post(
			`/_emdash/api/content/pages/${created.id}/unpublish`,
		);
		expect(unpublished.ok()).toBe(true);
		expect((await publicPage.request.get(renamedPath)).status()).toBe(404);
		await publishContentViaApi(authedRequest, "pages", created.id);
		expect((await publicPage.request.get(renamedPath)).status()).toBe(200);
		await deleteContentViaApi(authedRequest, "pages", created.id);
		deleted = true;
		expect((await publicPage.request.get(renamedPath)).status()).toBe(404);
	} finally {
		if (!deleted) await deleteContentViaApi(authedRequest, "pages", created.id);
	}
});

test("previews and edits a nested draft absent from the public path index", async ({
	authedRequest,
	publicPage,
	page,
}, testInfo) => {
	const slug = `nested-draft-${Date.now()}`;
	const path = `/cache-tests/${slug}/`;
	const title = uniqueTitle("E2E Nested Draft", testInfo.testId);
	expect((await publicPage.request.get(path)).status()).toBe(404);
	const created = await createContentViaApi(authedRequest, "pages", {
		title,
		slug,
		data: { path: `cache-tests/${slug}` },
	});
	try {
		const preview = await getPreviewUrlViaApi(
			authedRequest,
			"pages",
			created.id,
		);
		const previewToken = new URL(
			preview.url,
			"https://example.test",
		).searchParams.get("_preview");
		expect(previewToken).toBeTruthy();
		const response = await publicPage.request.get(
			`${path}?_preview=${previewToken}`,
		);
		expect(response.status()).toBe(200);
		expect(response.headers()["cache-control"]).toContain("no-store");
		expect(await response.text()).toContain(title);

		await page.goto("/_emdash/admin", { waitUntil: "domcontentloaded" });
		await dismissWelcome(page);
		await page.goto(path, { waitUntil: "domcontentloaded" });
		await expect(page.locator("#emdash-toolbar")).toBeVisible();
		await page.locator(".emdash-tb-toggle").click();
		await expect(
			page.locator('.emdash-inline-editor[contenteditable="true"]').first(),
		).toContainText(title);
		expect((await publicPage.request.get(path)).status()).toBe(404);
	} finally {
		await deleteContentViaApi(authedRequest, "pages", created.id);
	}
});
