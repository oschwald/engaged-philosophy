import type { Response } from "@playwright/test";

import { test, expect } from "../../fixtures/worker";
import { collectPageErrors } from "../../support/assertions";
import {
	createAndPublishContentViaApi,
	dismissWelcome,
	uploadMediaViaApi,
	uniqueTitle,
} from "../../support/content";

const PNG_1X1 = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
	"base64",
);

function contentApiPath(collection: string, id: string) {
	return `/_emdash/api/content/${collection}/${id}`;
}

function responseMatches(response: Response, method: string, pathName: string) {
	const url = new URL(response.url());
	return response.request().method() === method && url.pathname === pathName;
}

test.describe("admin legacy image editing", () => {
	test("shows the current legacy image selection when editing a block", async ({
		authedRequest,
		page,
	}, testInfo) => {
		const pageErrors = collectPageErrors(page);
		const title = uniqueTitle("E2E Legacy Image Edit", testInfo.testId);
		const filename = `legacy-image-edit-${testInfo.workerIndex}-${Date.now()}.png`;
		const media = await uploadMediaViaApi(authedRequest, {
			filename,
			mimeType: "image/png",
			buffer: PNG_1X1,
			width: 1,
			height: 1,
		});
		const imageUrl =
			media.url ?? `/_emdash/api/media/file/${media.storageKey ?? media.id}`;
		const originalAlt = "Current legacy image selection";
		const updatedAlt = "Updated legacy image selection";

		const { published } = await createAndPublishContentViaApi(
			authedRequest,
			"pages",
			{
				title,
				content: `${title} body.`,
				data: {
					content: [
						{
							_type: "block",
							_key: "intro",
							style: "normal",
							markDefs: [],
							children: [
								{
									_type: "span",
									_key: "intro-span",
									text: `${title} body.`,
									marks: [],
								},
							],
						},
						{
							_type: "legacyImage",
							_key: "legacy-image",
							id: imageUrl,
							alt: originalAlt,
							align: "left",
							shape: "rounded",
							width: 1,
							height: 1,
						},
					],
				},
			},
		);

		await page.goto(`/_emdash/admin/content/pages/${published.id}`, {
			waitUntil: "domcontentloaded",
		});
		await dismissWelcome(page);
		await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);

		const legacyBlock = page
			.locator(".plugin-block")
			.filter({ hasText: "Legacy image" })
			.first();
		await expect(legacyBlock).toBeVisible();
		await legacyBlock.click();
		await legacyBlock.getByRole("button", { name: "Edit" }).click({
			force: true,
		});

		const dialog = page.getByRole("dialog", { name: /Edit Legacy image/i });
		await expect(dialog).toBeVisible();
		await expect(dialog.locator(`img[src="${imageUrl}"]`)).toBeVisible();
		const altField = dialog.getByRole("textbox").first();
		await expect(altField).toHaveValue(originalAlt);

		await altField.fill(updatedAlt);
		const saveResponsePromise = page.waitForResponse((response) =>
			responseMatches(response, "PUT", contentApiPath("pages", published.id)),
		);
		await dialog.getByRole("button", { name: "Save" }).click();
		await expect(dialog).toBeHidden();
		const saveResponse = await saveResponsePromise;
		expect(saveResponse.status()).toBeGreaterThanOrEqual(200);
		expect(saveResponse.status()).toBeLessThan(300);
		await expect(
			page.getByRole("button", { name: "Saved", exact: true }).first(),
		).toBeVisible();

		const saved = await authedRequest.get(
			`/_emdash/api/content/pages/${published.id}`,
		);
		expect(saved.status()).toBeGreaterThanOrEqual(200);
		expect(saved.status()).toBeLessThan(300);
		const savedBody = (await saved.json()) as {
			data?: {
				item?: {
					data?: {
						content?: Array<Record<string, unknown>>;
					};
				};
			};
		};
		const legacyImage = savedBody.data?.item?.data?.content?.find(
			(block) => block._type === "legacyImage",
		);
		expect(legacyImage).toEqual(
			expect.objectContaining({
				id: imageUrl,
				alt: updatedAlt,
			}),
		);

		pageErrors.expectNone();
	});
});
