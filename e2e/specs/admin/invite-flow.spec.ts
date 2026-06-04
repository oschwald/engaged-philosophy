import { test, expect } from "../../fixtures/worker";
import { collectPageErrors } from "../../support/assertions";
import { dismissWelcome } from "../../support/content";

test.describe("admin user invites", () => {
	test("creates a Cloudflare Access user and shows a manual invite link", async ({
		page,
	}, testInfo) => {
		const pageErrors = collectPageErrors(page);
		const email = `invite-${testInfo.workerIndex}-${Date.now()}@example.test`;

		await page.goto("/_emdash/admin/users", { waitUntil: "domcontentloaded" });
		await dismissWelcome(page);
		await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

		await page.getByRole("button", { name: "Invite User" }).click();
		const dialog = page.getByRole("dialog", { name: "Invite User" });
		await expect(dialog).toBeVisible();
		await dialog.getByLabel("Email address").fill(email);

		const inviteResponsePromise = page.waitForResponse((response) => {
			const url = new URL(response.url());
			return (
				response.request().method() === "POST" &&
				url.pathname === "/_emdash/api/auth/invite"
			);
		});
		await dialog.getByRole("button", { name: "Send Invite" }).click();

		const inviteResponse = await inviteResponsePromise;
		expect(inviteResponse.status()).toBeGreaterThanOrEqual(200);
		expect(inviteResponse.status()).toBeLessThan(300);
		const inviteBody = (await inviteResponse.json()) as {
			data?: { inviteUrl?: string };
		};
		expect(inviteBody.data?.inviteUrl).toContain("/_emdash/admin");

		await expect(page.getByText("Invite Link Created")).toBeVisible();
		await expect(
			page.getByText("Share this link with the invited user"),
		).toBeVisible();
		await expect(page.getByText(/\/_emdash\/admin/)).toBeVisible();
		await page.getByRole("button", { name: "Done" }).click();

		await page.getByLabel("Search users").fill(email);
		await expect(page.getByText(email)).toBeVisible();
		pageErrors.expectNone();
	});
});
