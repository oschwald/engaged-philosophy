import {
	createAndPublishContentViaApi,
	uniqueTitle,
} from "../../support/content";
import { expect, test } from "../../fixtures/worker";

test.describe("public search", () => {
	test("finds published content through the EmDash index", async ({
		authedRequest,
		publicPage,
	}, testInfo) => {
		const searchTerm = `searchable-${testInfo.workerIndex}-${Date.now()}`;
		const title = uniqueTitle("E2E Search", testInfo.testId);

		const { publicPath } = await createAndPublishContentViaApi(
			authedRequest,
			"pages",
			{
				title,
				content: `${title} content containing ${searchTerm}.`,
				data: {
					content: [
						{
							_type: "block",
							_key: "content",
							style: "normal",
							markDefs: [],
							children: [
								{
									_type: "span",
									_key: "content-text",
									text: `${title} content containing ${searchTerm}.`,
									marks: [],
								},
							],
						},
					],
				},
			},
		);

		const searchResponse = await authedRequest.get(
			`/_emdash/api/search?q=${encodeURIComponent(searchTerm)}&collections=pages`,
		);
		expect(searchResponse.ok()).toBe(true);
		await expect(searchResponse.json()).resolves.toMatchObject({
			data: {
				items: [{ collection: "pages" }],
			},
		});

		await publicPage.goto(`/?s=${encodeURIComponent(searchTerm)}`);

		await expect(
			publicPage.getByRole("heading", {
				name: `Search Results for: ${searchTerm}`,
			}),
		).toBeVisible();
		await expect(
			publicPage.getByRole("heading", { name: title }),
		).toBeVisible();
		await expect(
			publicPage.getByRole("link", { name: "Continue reading →" }),
		).toHaveAttribute("href", publicPath);
	});
});
