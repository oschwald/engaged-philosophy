import { test, expect } from "../../fixtures/worker";
import {
	collectPageErrors,
	expectExactHeading,
} from "../../support/assertions";
import { dismissWelcome } from "../../support/content";

function svgBuffer(label: string) {
	return Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><title>${label}</title><rect width="1" height="1" fill="#4b8f8c"/></svg>`,
	);
}

test.describe("admin media library", () => {
	test("uploads and finds an image from the media page", async ({
		page,
	}, testInfo) => {
		const pageErrors = collectPageErrors(page, {
			ignore: [/status of 501 \(Not Implemented\)/],
		});
		const filename = `e2e-upload-${testInfo.workerIndex}-${Date.now()}.svg`;

		await page.goto("/_emdash/admin/media", { waitUntil: "domcontentloaded" });
		await dismissWelcome(page);
		await expectExactHeading(page, "Media Library");
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
			mimeType: "image/svg+xml",
			buffer: svgBuffer(filename),
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
