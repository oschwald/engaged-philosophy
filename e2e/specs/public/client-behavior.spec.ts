import { test, expect } from "../../fixtures/worker";
import {
	createAndPublishContentViaApi,
	deleteContentViaApi,
	uniqueTitle,
} from "../../support/content";

test("links skip navigation only to targets present on every page", async ({
	publicPage,
}) => {
	await publicPage.goto("/");

	const skipLinks = publicPage.locator(".skip-link a");
	await expect(skipLinks).toHaveCount(1);
	await expect(skipLinks).toHaveAttribute("href", "#content");
	await expect(publicPage.locator("#content")).toHaveCount(1);
});

test("opens AI search without replacing conventional search", async ({
	publicPage,
}) => {
	const contentSecurityPolicyErrors: string[] = [];
	publicPage.on("console", (message) => {
		if (message.text().includes("Content Security Policy")) {
			contentSecurityPolicyErrors.push(
				`${message.text()} ${JSON.stringify(message.location())}`,
			);
		}
	});
	await publicPage.route("**/api/ai-search/search", async (route) => {
		expect(route.request().postDataJSON()).toMatchObject({
			messages: [{ role: "user", content: "community partnerships" }],
			ai_search_options: { retrieval: { max_num_results: 8 } },
		});
		await route.fulfill({
			contentType: "application/json",
			body: JSON.stringify({
				success: true,
				result: {
					chunks: [
						{
							item: {
								key: "/pages/community-engagement",
								metadata: {
									title: "Community engagement",
									description: "Philosophy beyond the classroom.",
								},
							},
						},
						{
							item: {
								key: "https://example.com/not-a-site-result",
								metadata: { title: "External result" },
							},
						},
					],
				},
			}),
		});
	});

	const response = await publicPage.goto("/");
	expect(response?.headers()["content-security-policy"]).toContain(
		"style-src 'self'",
	);
	const baselineContentSecurityPolicyErrors = [...contentSecurityPolicyErrors];

	await expect(publicPage.locator("#searchform")).toBeVisible();
	const modal = publicPage.locator("[data-ai-search-dialog]");
	const searchInput = modal.locator("[data-ai-search-query]");
	await expect(searchInput).toBeHidden();
	await publicPage.getByRole("button", { name: "AI search" }).click();
	await expect(searchInput).toBeVisible();
	await expect(searchInput).toBeFocused();

	await searchInput.fill("community partnerships");
	await expect(modal.getByRole("status")).toHaveText("1 related result.");
	await expect(
		modal.getByRole("link", { name: /Community engagement/ }),
	).toHaveAttribute("href", "/pages/community-engagement");
	await expect(
		modal.getByRole("link", { name: "Use conventional search" }),
	).toHaveAttribute("href", "/?s=community%20partnerships");

	await modal.getByRole("button", { name: "Close AI search" }).click();
	await expect(searchInput).toBeHidden();
	expect(contentSecurityPolicyErrors).toEqual(
		baselineContentSecurityPolicyErrors,
	);
	await publicPage.getByRole("button", { name: "AI search" }).click();
	await expect(searchInput).toHaveValue("");
	await expect(modal.getByRole("status")).toHaveText(
		"Enter at least two characters to search.",
	);
	await expect(modal.locator("[data-ai-search-results] li")).toHaveCount(0);
	await modal.getByRole("button", { name: "Close AI search" }).click();

	await publicPage.setViewportSize({ width: 390, height: 844 });
	await publicPage.getByRole("button", { name: "Toggle navigation" }).click();
	await expect(publicPage.locator("#searchform")).toBeVisible();
	await publicPage.getByRole("button", { name: "AI search" }).click();
	await expect(searchInput).toBeVisible();

	const dialogBounds = await modal.boundingBox();
	expect(dialogBounds).not.toBeNull();
	expect(dialogBounds!.x).toBeGreaterThanOrEqual(0);
	expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(390);
	expect(dialogBounds!.y).toBeGreaterThanOrEqual(0);
	expect(dialogBounds!.y + dialogBounds!.height).toBeLessThanOrEqual(844);
});

test("uses Bootstrap data APIs for public theme interactions", async ({
	authedRequest,
	publicPage,
}, testInfo) => {
	const firstTitle = uniqueTitle("E2E Carousel First", testInfo.testId);
	const secondTitle = uniqueTitle("E2E Carousel Second", testInfo.testId);
	const projectIds: string[] = [];

	try {
		for (const [title, menuOrder] of [
			[firstTitle, 1],
			[secondTitle, 2],
		] as const) {
			const { created } = await createAndPublishContentViaApi(
				authedRequest,
				"projects",
				{
					title,
					data: {
						highlight: true,
						menu_order: menuOrder,
					},
				},
			);
			projectIds.push(created.id);
		}

		await publicPage.goto("/");

		const carousel = publicPage.locator("#projects_carousel");
		await expect(carousel).toHaveAttribute("data-bs-interval", "30000");
		await expect(
			carousel
				.locator(".carousel-item.active")
				.getByRole("heading", { name: firstTitle, exact: true }),
		).toBeVisible();

		await carousel.getByRole("button", { name: "Next" }).click();
		await expect(
			carousel
				.locator(".carousel-item.active")
				.getByRole("heading", { name: secondTitle, exact: true }),
		).toBeVisible();

		const resources = publicPage.getByRole("link", { name: "Resources" });
		await resources.click();
		await expect(
			resources.locator("xpath=..").locator(".dropdown-menu"),
		).toHaveClass(/show/);
	} finally {
		const cleanupErrors: unknown[] = [];
		for (const id of projectIds) {
			try {
				await deleteContentViaApi(authedRequest, "projects", id);
			} catch (error) {
				cleanupErrors.push(error);
			}
		}
		if (cleanupErrors.length > 0) {
			throw new AggregateError(
				cleanupErrors,
				"Failed to clean up one or more test projects",
			);
		}
	}
});
