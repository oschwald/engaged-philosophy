import type { Page, Response } from "@playwright/test";

import { test, expect } from "../../fixtures/worker";
import {
	collectPageErrors,
	expectExactHeading,
} from "../../support/assertions";
import {
	createAndPublishContentViaApi,
	dismissWelcome,
	expectPublicContent,
	portableTextParagraph,
	uniqueTitle,
} from "../../support/content";

function contentApiPath(collection: string, id: string) {
	return `/_emdash/api/content/${collection}/${id}`;
}

function responseMatches(response: Response, method: string, pathName: string) {
	const url = new URL(response.url());
	return response.request().method() === method && url.pathname === pathName;
}

async function expectEditMode(page: Page, enabled: boolean) {
	await expect(
		page.locator(`#emdash-toolbar[data-edit-mode="${enabled}"]`),
	).toBeVisible({ timeout: 15_000 });
}

async function toggleEditMode(page: Page, enabled: boolean) {
	const toolbar = page.locator("#emdash-toolbar");
	await expect(toolbar).toBeVisible();

	if ((await toolbar.getAttribute("data-edit-mode")) === String(enabled)) {
		return;
	}

	await page.locator(".emdash-tb-toggle").click();
	await expectEditMode(page, enabled);
}

function collectEditingPageErrors(page: Page) {
	return collectPageErrors(page, {
		ignore: [
			/Failed to load resource: the server responded with a status of 404 \(Not Found\) \(http:\/\/127\.0\.0\.1:\d+\/favicon\.ico\)/,
		],
	});
}

test.describe("visual editing", () => {
	test("saves portable text before leaving edit mode and publishing", async ({
		authedRequest,
		page,
		publicPage,
	}, testInfo) => {
		const pageErrors = collectEditingPageErrors(page);
		const title = uniqueTitle("E2E Visual Editing", testInfo.testId);
		const initialBody = `${title} original body.`;
		const editedText = `saved before leaving edit mode ${Date.now()}`;
		const { publicPath, published } = await createAndPublishContentViaApi(
			authedRequest,
			"pages",
			{
				title,
				content: initialBody,
			},
		);

		await page.goto("/_emdash/admin", { waitUntil: "domcontentloaded" });
		await dismissWelcome(page);
		await expectExactHeading(page, "Dashboard");

		await page.goto(publicPath, { waitUntil: "domcontentloaded" });
		await expect(page.locator("#emdash-toolbar")).toBeVisible();
		await toggleEditMode(page, true);

		const editor = page
			.locator('.emdash-inline-editor[contenteditable="true"]')
			.first();
		await expect(editor).toBeVisible({ timeout: 15_000 });
		await expect(editor).toContainText(initialBody);

		await editor.click();
		await page.keyboard.press("End");
		await page.keyboard.type(` ${editedText}`);
		await expect(page.locator("#emdash-tb-save-status")).toContainText(
			"Unsaved",
		);

		const saveResponsePromise = page.waitForResponse((response) =>
			responseMatches(response, "PUT", contentApiPath("pages", published.id)),
		);
		await page.locator(".emdash-tb-toggle").click();
		const saveResponse = await saveResponsePromise;
		expect(
			saveResponse.status(),
			"Expected inline edit save to return 2xx",
		).toBeGreaterThanOrEqual(200);
		expect(
			saveResponse.status(),
			"Expected inline edit save to return 2xx",
		).toBeLessThan(300);
		await expectEditMode(page, false);
		await expect(page.getByText("Save failed")).toHaveCount(0);

		await toggleEditMode(page, true);
		await expect(editor).toContainText(editedText);
		await expect(page.locator("#emdash-tb-publish")).toBeVisible();

		const publishResponsePromise = page.waitForResponse((response) =>
			responseMatches(
				response,
				"POST",
				`${contentApiPath("pages", published.id)}/publish`,
			),
		);
		await page.locator("#emdash-tb-publish").click();
		const publishResponse = await publishResponsePromise;
		expect(
			publishResponse.status(),
			"Expected inline edit publish to return 2xx",
		).toBeGreaterThanOrEqual(200);
		expect(
			publishResponse.status(),
			"Expected inline edit publish to return 2xx",
		).toBeLessThan(300);

		await expect(page.locator("#emdash-tb-status")).toContainText("Published", {
			timeout: 15_000,
		});
		await expectPublicContent(publicPage, publicPath, title, editedText);

		pageErrors.expectNone();
	});

	test("keeps portable text editable when legacy blocks are present", async ({
		authedRequest,
		page,
		publicPage,
	}, testInfo) => {
		const pageErrors = collectEditingPageErrors(page);
		const title = uniqueTitle("E2E Legacy Visual Editing", testInfo.testId);
		const initialBody = `${title} body before legacy edit.`;
		const editedText = `edited around legacy blocks ${Date.now()}`;
		const { publicPath, published } = await createAndPublishContentViaApi(
			authedRequest,
			"pages",
			{
				title,
				data: {
					content: [
						...portableTextParagraph(initialBody),
						{
							_type: "legacyPageList",
							_key: "legacy-page-list",
						},
					],
				},
			},
		);

		await page.goto("/_emdash/admin", { waitUntil: "domcontentloaded" });
		await dismissWelcome(page);
		await page.goto(publicPath, { waitUntil: "domcontentloaded" });
		await toggleEditMode(page, true);

		const editor = page
			.locator('.emdash-inline-editor[contenteditable="true"]')
			.filter({ hasText: initialBody })
			.first();
		await expect(editor).toBeVisible({ timeout: 15_000 });

		await editor.click();
		await page.keyboard.press("End");
		await page.keyboard.type(` ${editedText}`);
		await expect(page.locator("#emdash-tb-save-status")).toContainText(
			"Unsaved",
		);

		const saveResponsePromise = page.waitForResponse((response) =>
			responseMatches(response, "PUT", contentApiPath("pages", published.id)),
		);
		await page.locator(".emdash-tb-toggle").click();
		const saveResponse = await saveResponsePromise;
		expect(
			saveResponse.status(),
			"Expected inline legacy-page edit save to return 2xx",
		).toBeGreaterThanOrEqual(200);
		expect(
			saveResponse.status(),
			"Expected inline legacy-page edit save to return 2xx",
		).toBeLessThan(300);
		await expectEditMode(page, false);
		await expect(page.getByText("Save failed")).toHaveCount(0);

		await toggleEditMode(page, true);
		await expect(editor).toContainText(editedText);
		await expect(page.locator("#emdash-tb-publish")).toBeVisible();

		const publishResponsePromise = page.waitForResponse((response) =>
			responseMatches(
				response,
				"POST",
				`${contentApiPath("pages", published.id)}/publish`,
			),
		);
		await page.locator("#emdash-tb-publish").click();
		const publishResponse = await publishResponsePromise;
		expect(
			publishResponse.status(),
			"Expected inline legacy-page edit publish to return 2xx",
		).toBeGreaterThanOrEqual(200);
		expect(
			publishResponse.status(),
			"Expected inline legacy-page edit publish to return 2xx",
		).toBeLessThan(300);
		await expect(page.locator("#emdash-tb-status")).toContainText("Published", {
			timeout: 15_000,
		});

		await expectPublicContent(publicPage, publicPath, title, editedText);
		pageErrors.expectNone();
	});
});
