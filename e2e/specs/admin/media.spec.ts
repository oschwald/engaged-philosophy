import { readFile } from "node:fs/promises";
import { test, expect } from "../../fixtures/worker";
import {
	collectPageErrors,
	expectExactHeading,
} from "../../support/assertions";
import { dismissWelcome } from "../../support/content";

const UPLOAD_FIXTURE = new URL("../../../public/img/logo.png", import.meta.url);

test.describe("admin media library", () => {
	test("uploads and finds an image from the media page", async ({
		page,
	}, testInfo) => {
		const pageErrors = collectPageErrors(page, {
			ignore: [/status of 501 \(Not Implemented\)/],
		});
		const filename = `e2e-upload-${testInfo.workerIndex}-${Date.now()}.png`;

		await page.goto("/_emdash/admin/media", { waitUntil: "domcontentloaded" });
		await dismissWelcome(page);
		await expectExactHeading(page, "Media Library");
		const uploadButton = page
			.getByRole("button", { name: "Upload Files" })
			.first();
		await expect(uploadButton).toBeVisible();
		await uploadButton.click();
		const uploadDialog = page.getByRole("dialog", {
			name: "Upload to Library",
		});
		await expect(uploadDialog).toBeVisible();

		const uploadResponsePromise = page.waitForResponse((response) => {
			const url = new URL(response.url());
			return (
				response.request().method() === "POST" &&
				/^\/_emdash\/api\/media\/[^/]+\/confirm$/.test(url.pathname)
			);
		});
		await uploadDialog.getByLabel("Browse files to upload").setInputFiles({
			name: filename,
			mimeType: "image/png",
			buffer: await readFile(UPLOAD_FIXTURE),
		});
		const uploadResponse = await uploadResponsePromise;
		expect(
			uploadResponse.status(),
			"Expected media upload to return 2xx",
		).toBeGreaterThanOrEqual(200);
		expect(
			uploadResponse.status(),
			"Expected media upload to return 2xx",
		).toBeLessThan(300);
		const uploadBody = (await uploadResponse.json()) as {
			data?: { item?: { filename?: string } };
		};
		expect(uploadBody.data?.item?.filename).toBe(filename);

		await page.reload({ waitUntil: "domcontentloaded" });
		await expectExactHeading(page, "Media Library");
		await page.getByLabel("Search media").fill(filename);
		await expect(page.getByText(filename)).toBeVisible({ timeout: 10_000 });

		pageErrors.expectNone();
	});
});
