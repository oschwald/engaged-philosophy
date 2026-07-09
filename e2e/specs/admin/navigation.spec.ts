import { test, expect } from "../../fixtures/worker";
import {
	collectPageErrors,
	expectExactHeading,
} from "../../support/assertions";
import { dismissWelcome } from "../../support/content";

test.describe("admin navigation", () => {
	test("opens the primary admin sections from the sidebar", async ({
		page,
	}) => {
		const pageErrors = collectPageErrors(page);
		await page.goto("/_emdash/admin", { waitUntil: "domcontentloaded" });
		await dismissWelcome(page);
		await expectExactHeading(page, "Dashboard");

		const destinations = [
			{
				link: "Pages",
				path: "/_emdash/admin/content/pages",
				heading: "Pages",
			},
			{
				link: "Posts",
				path: "/_emdash/admin/content/posts",
				heading: "Posts",
			},
			{
				link: "Projects",
				path: "/_emdash/admin/content/projects",
				heading: "Projects",
			},
			{ link: "Media", path: "/_emdash/admin/media", heading: "Media Library" },
			{ link: "Users", path: "/_emdash/admin/users", heading: "Users" },
			{
				link: "Plugins",
				path: "/_emdash/admin/plugins-manager",
				heading: "Plugins",
			},
			{
				link: "Settings",
				path: "/_emdash/admin/settings",
				heading: "Settings",
			},
			{
				link: "Audit History",
				path: "/_emdash/admin/plugins/audit-log/history",
				heading: "Audit History",
			},
		];

		for (const destination of destinations) {
			await page
				.getByRole("link", { name: destination.link, exact: true })
				.first()
				.click();
			await expect(page).toHaveURL(new RegExp(`${destination.path}$`));
			await expectExactHeading(page, destination.heading);
			await expect(page.getByText("Authentication required")).toHaveCount(0);
		}

		pageErrors.expectNone();
	});
});
