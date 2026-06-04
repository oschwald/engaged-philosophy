import { test, expect } from "../../fixtures/worker";
import { collectPageErrors } from "../../support/assertions";
import { dismissWelcome } from "../../support/content";

const PNG_1X1 = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
	"base64",
);

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
		await expect(
			page.getByRole("heading", { name: "Media Library" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Upload to Library" }),
		).toBeVisible();

		const uploadResponsePromise = page.waitForResponse((response) => {
			const url = new URL(response.url());
			return (
				response.request().method() === "POST" &&
				url.pathname === "/_emdash/api/media"
			);
		});
		await page.getByLabel("Upload files").setInputFiles({
			name: filename,
			mimeType: "image/png",
			buffer: PNG_1X1,
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

		await expect(page.getByText(filename)).toBeVisible();
		await page.getByLabel("Search media").fill(filename);
		await expect(page.getByText(filename)).toBeVisible();

		pageErrors.expectNone();
	});
});
