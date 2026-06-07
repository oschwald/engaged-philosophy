import { test, expect } from "../../fixtures/worker";
import { collectPageErrors } from "../../support/assertions";
import {
	canonicalAliasForItem,
	createAndPublishContentViaAdmin,
	dismissWelcome,
	expectPublicContent,
	uniqueTitle,
} from "../../support/content";

test.describe("admin content workflows", () => {
	test("creates and publishes a page from the admin editor", async ({
		page,
		publicPage,
	}, testInfo) => {
		const pageErrors = collectPageErrors(page);
		const title = uniqueTitle("E2E Admin Page", testInfo.testId);
		const bodyText = `${title} body created through the admin editor.`;

		const { publicPath } = await createAndPublishContentViaAdmin(
			page,
			"pages",
			{
				title,
				content: bodyText,
			},
		);

		await expectPublicContent(publicPage, publicPath, title, bodyText);

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
});
