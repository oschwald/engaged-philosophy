import { test, expect } from "../../fixtures/worker";
import {
	createAndPublishContentViaApi,
	createContentViaApi,
	deleteContentViaApi,
	expectPublicContent,
	getPreviewUrlViaApi,
	uniqueTitle,
	updateContentViaApi,
} from "../../support/content";

for (const publishedAt of [undefined, "2022-05-31T23:59:59.999Z"]) {
	test(`previews a ${publishedAt ? "dated" : "dateless"} draft post without exposing it publicly`, async ({
		authedRequest,
		publicPage,
	}, testInfo) => {
		const title = uniqueTitle("E2E Draft Post", testInfo.testId);
		const bodyText = `${title} preview body.`;
		const created = await createContentViaApi(authedRequest, "posts", {
			title,
			content: bodyText,
			publishedAt,
		});
		try {
			const preview = await getPreviewUrlViaApi(
				authedRequest,
				"posts",
				created.id,
			);
			const previewUrl = new URL(preview.url, "https://example.test");
			const response = await publicPage.request.get(preview.url, {
				maxRedirects: 0,
			});
			expect(response.status()).toBe(publishedAt ? 302 : 200);
			expect(response.headers()["cache-control"]).toContain("no-store");
			await expectPublicContent(publicPage, preview.url, title, bodyText);
			expect(new URL(publicPage.url()).searchParams.get("_preview")).toBe(
				previewUrl.searchParams.get("_preview"),
			);
			if (publishedAt)
				expect(new URL(publicPage.url()).pathname).toBe(
					`/2022/05/31/${created.slug}/`,
				);
			const anonymous = await publicPage.request.get(
				new URL(publicPage.url()).pathname,
			);
			expect(anonymous.status()).toBe(404);
		} finally {
			await deleteContentViaApi(authedRequest, "posts", created.id);
		}
	});
}

test("uses native post dates in links and redirects and rejects incorrect dates", async ({
	authedRequest,
	publicPage,
}, testInfo) => {
	const title = uniqueTitle("E2E Native Post", testInfo.testId);
	const bodyText = `${title} public body.`;
	const { published, publicPath } = await createAndPublishContentViaApi(
		authedRequest,
		"posts",
		{ title, content: bodyText, publishedAt: "2022-05-31T23:59:59.999Z" },
	);
	try {
		expect(publicPath).toBe(`/2022/05/31/${published.slug}/`);
		await expectPublicContent(publicPage, publicPath, title, bodyText);
		await expect(publicPage.locator(".entry-meta").first()).toHaveText(
			"May 31, 2022",
		);
		await expect(publicPage.locator('link[rel="canonical"]')).toHaveAttribute(
			"href",
			`https://www.engagedphilosophy.com${publicPath}`,
		);
		for (const wrong of [
			`/2022/06/01/${published.slug}/`,
			`/2022/99/99/${published.slug}/`,
		]) {
			expect((await publicPage.request.get(wrong)).status()).toBe(404);
		}
		const newSlug = `${published.slug}-renamed`;
		await updateContentViaApi(authedRequest, "posts", published.id, {
			slug: newSlug,
		});
		const redirect = await publicPage.request.get(publicPath, {
			maxRedirects: 0,
		});
		expect(redirect.status()).toBe(301);
		expect(redirect.headers().location).toBe(`/2022/05/31/${newSlug}`);
		await expectPublicContent(
			publicPage,
			`/2022/05/31/${newSlug}/`,
			title,
			bodyText,
		);
	} finally {
		await deleteContentViaApi(authedRequest, "posts", published.id);
	}
});

test("resolves an encoded post slug on its canonical date route", async ({
	authedRequest,
	publicPage,
}, testInfo) => {
	const title = uniqueTitle("E2E Encoded Post", testInfo.testId);
	const slug = `café-${testInfo.testId.replace(/[^a-z0-9]/gi, "").slice(-12)}`;
	const { published } = await createAndPublishContentViaApi(
		authedRequest,
		"posts",
		{
			title,
			slug,
			content: `${title} body.`,
			publishedAt: "2022-05-31T23:59:59.999Z",
		},
	);
	try {
		const path = `/2022/05/31/${encodeURIComponent(slug)}/`;
		await expectPublicContent(publicPage, path, title, `${title} body.`);
		await expect(publicPage.locator('link[rel="canonical"]')).toHaveAttribute(
			"href",
			`https://www.engagedphilosophy.com${path}`,
		);
	} finally {
		await deleteContentViaApi(authedRequest, "posts", published.id);
	}
});
