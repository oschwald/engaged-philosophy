import { test, expect } from "../../fixtures/worker";
import {
	createAndPublishContentViaApi,
	uniqueTitle,
} from "../../support/content";

test("uses Bootstrap data APIs for public theme interactions", async ({
	authedRequest,
	publicPage,
}, testInfo) => {
	const firstTitle = uniqueTitle("E2E Carousel First", testInfo.testId);
	const secondTitle = uniqueTitle("E2E Carousel Second", testInfo.testId);

	for (const [title, menuOrder] of [
		[firstTitle, 1],
		[secondTitle, 2],
	] as const) {
		await createAndPublishContentViaApi(authedRequest, "projects", {
			title,
			data: {
				highlight: true,
				menu_order: menuOrder,
			},
		});
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
});
