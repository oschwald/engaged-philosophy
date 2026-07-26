import { test, expect } from "../../fixtures/worker";
import { collectPageErrors } from "../../support/assertions";
import {
	canonicalAliasForItem,
	createAndPublishContentViaApi,
	createAndPublishContentViaAdmin,
	createContentViaApi,
	deleteContentViaApi,
	dismissWelcome,
	expectPublicContent,
	getPreviewUrlViaApi,
	portableTextParagraph,
	uniqueTitle,
	updateContentViaApi,
} from "../../support/content";

interface SavedContentResponse {
	data?: {
		item?: {
			data?: {
				content?: Array<Record<string, unknown>>;
			};
		};
	};
}

test.describe("admin content workflows", () => {
	test("creates and publishes a page from the admin editor", async ({
		page,
		publicPage,
	}, testInfo) => {
		const pageErrors = collectPageErrors(page);
		const title = uniqueTitle("E2E Admin Page", testInfo.testId);
		const bodyText = `${title} body created through the admin editor.`;

		const { published, publicPath } = await createAndPublishContentViaAdmin(
			page,
			"pages",
			{
				title,
				content: bodyText,
			},
		);

		await expectPublicContent(publicPage, publicPath, title, bodyText);
		const alias = canonicalAliasForItem("pages", published);
		const aliasResponse = await publicPage.request.get(alias, {
			maxRedirects: 0,
		});
		expect(aliasResponse.status()).toBe(301);
		expect(aliasResponse.headers().location).toBe(publicPath);

		await page.goto("/_emdash/admin/content/pages", {
			waitUntil: "domcontentloaded",
		});
		await dismissWelcome(page);
		await page.getByLabel("Search pages").fill(title);
		await expect(
			page.getByRole("link", { name: title, exact: true }),
		).toBeVisible();

		pageErrors.expectNone();
	});

	test("loads and preserves native galleries in the admin editor", async ({
		authedRequest,
		page,
	}, testInfo) => {
		const pageErrors = collectPageErrors(page);
		const title = uniqueTitle("E2E Native Gallery", testInfo.testId);
		const updatedTitle = `${title} updated`;
		const gallery = {
			_type: "gallery",
			_key: "native-gallery",
			columns: 2,
			images: [
				{
					_type: "image",
					_key: "gallery-image-1",
					asset: {
						_type: "reference",
						_ref: "gallery-media-1",
						url: "/img/logo.png",
					},
					alt: "Gallery image one",
				},
				{
					_type: "image",
					_key: "gallery-image-2",
					asset: {
						_type: "reference",
						_ref: "gallery-media-2",
						url: "/img/logo.png",
					},
					alt: "Gallery image two",
				},
			],
		};
		const created = await createContentViaApi(authedRequest, "pages", {
			title,
			data: {
				content: [...portableTextParagraph(`${title} body.`), gallery],
			},
		});

		try {
			await page.goto(`/_emdash/admin/content/pages/${created.id}`, {
				waitUntil: "domcontentloaded",
			});
			await dismissWelcome(page);

			await expect(
				page.getByRole("button", { name: "Edit image 1" }),
			).toBeVisible();
			await expect(
				page.getByRole("button", { name: "Edit image 2" }),
			).toBeVisible();

			await page.getByRole("button", { name: "Edit image 1" }).click();
			await expect(
				page.getByRole("heading", { name: "Gallery", exact: true }),
			).toBeVisible();
			await page
				.getByRole("button", { name: "Close gallery settings" })
				.click();

			await page.getByLabel("Title", { exact: true }).fill(updatedTitle);
			const saveResponsePromise = page.waitForResponse((response) => {
				const url = new URL(response.url());
				return (
					response.request().method() === "PUT" &&
					url.pathname === `/_emdash/api/content/pages/${created.id}`
				);
			});
			await page
				.getByRole("button", { name: "Save", exact: true })
				.first()
				.click();
			const saveResponse = await saveResponsePromise;
			expect(saveResponse.ok()).toBe(true);

			const saveBody = (await saveResponse.json()) as SavedContentResponse;
			const savedGallery = saveBody.data?.item?.data?.content?.find(
				(block) => block._type === "gallery",
			);
			expect(savedGallery).toMatchObject({
				_type: gallery._type,
				columns: gallery.columns,
				images: gallery.images,
			});

			pageErrors.expectNone();
		} finally {
			await deleteContentViaApi(authedRequest, "pages", created.id);
		}
	});

	test("creates posts and projects with their public canonical routes", async ({
		page,
		publicPage,
	}, testInfo) => {
		for (const collection of ["posts", "projects"] as const) {
			const title = uniqueTitle(`E2E Admin ${collection}`, testInfo.testId);
			const bodyText = `${title} body created through the admin editor.`;
			const { published, publicPath } = await createAndPublishContentViaAdmin(
				page,
				collection,
				{ title, content: bodyText },
			);

			await expectPublicContent(publicPage, publicPath, title, bodyText);

			const alias = canonicalAliasForItem(collection, published);
			const aliasResponse = await publicPage.request.get(alias, {
				maxRedirects: 0,
			});
			expect(aliasResponse.status()).toBe(301);
			expect(aliasResponse.headers().location).toBe(publicPath);
			const response = await publicPage.goto(alias, {
				waitUntil: "domcontentloaded",
			});
			expect(response, `Expected ${alias} to return a response`).not.toBeNull();
			expect(
				response?.status(),
				`Expected ${alias} to redirect or load`,
			).toBeGreaterThanOrEqual(200);
			expect(
				response?.status(),
				`Expected ${alias} to redirect or load`,
			).toBeLessThan(400);
			expect(new URL(publicPage.url()).pathname).toBe(publicPath);
		}
	});

	test("previews a draft project on its canonical route", async ({
		authedRequest,
		publicPage,
	}, testInfo) => {
		const title = uniqueTitle("E2E Draft Project", testInfo.testId);
		const bodyText = `${title} body visible only through preview.`;
		const created = await createContentViaApi(authedRequest, "projects", {
			title,
			content: bodyText,
		});

		try {
			const preview = await getPreviewUrlViaApi(
				authedRequest,
				"projects",
				created.id,
			);
			const requestedUrl = new URL(preview.url, "https://example.test");
			const previewToken = requestedUrl.searchParams.get("_preview");

			expect(requestedUrl.pathname).toBe(`/projects/${created.id}`);
			expect(previewToken).toBeTruthy();

			const redirectResponse = await publicPage.request.get(preview.url, {
				maxRedirects: 0,
			});
			expect(redirectResponse.status()).toBe(302);
			expect(redirectResponse.headers().location).toBe(
				`/project/${created.slug}/${requestedUrl.search}`,
			);

			await expectPublicContent(publicPage, preview.url, title, bodyText);
			const finalUrl = new URL(publicPage.url());
			expect(finalUrl.pathname).toBe(`/project/${created.slug}/`);
			expect(finalUrl.searchParams.get("_preview")).toBe(previewToken);
		} finally {
			await deleteContentViaApi(authedRequest, "projects", created.id);
		}
	});

	test("redirects a project's old native URL after its slug changes", async ({
		authedRequest,
		publicPage,
	}, testInfo) => {
		const title = uniqueTitle("E2E Renamed Project", testInfo.testId);
		const bodyText = `${title} body remains available after renaming.`;
		const { published, publicPath } = await createAndPublishContentViaApi(
			authedRequest,
			"projects",
			{ title, content: bodyText },
		);
		const newSlug = `${published.slug}-renamed`;

		try {
			const updated = await updateContentViaApi(
				authedRequest,
				"projects",
				published.id,
				{ slug: newSlug },
			);
			expect(updated.slug).toBe(newSlug);

			const redirectResponse = await publicPage.request.get(publicPath, {
				maxRedirects: 0,
			});
			expect(redirectResponse.status()).toBe(301);
			expect(redirectResponse.headers().location).toBe(`/project/${newSlug}`);

			await expectPublicContent(
				publicPage,
				`/project/${newSlug}/`,
				title,
				bodyText,
			);
		} finally {
			await deleteContentViaApi(authedRequest, "projects", published.id);
		}
	});
});
