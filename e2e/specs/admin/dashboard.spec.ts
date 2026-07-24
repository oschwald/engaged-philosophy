import { test, expect } from "../../fixtures/worker";
import { collectPageErrors, expectOkJson } from "../../support/assertions";

test.describe("admin worker integration", () => {
	test("loads the admin shell", async ({ page }) => {
		const pageErrors = collectPageErrors(page);
		const response = await page.goto("/_emdash/admin", {
			waitUntil: "domcontentloaded",
		});

		expect(response, "Expected an admin page response").not.toBeNull();
		expect(
			response?.status(),
			"Expected admin page to load",
		).toBeGreaterThanOrEqual(200);
		expect(response?.status(), "Expected admin page to load").toBeLessThan(300);
		await expect(page.getByText("Authentication required")).toHaveCount(0);
		pageErrors.expectNone();
	});

	test("serves authenticated admin APIs", async ({ authedRequest }) => {
		const me = await expectOkJson(authedRequest, "/_emdash/api/auth/me");
		expect(me?.data?.email).toBe("admin@example.test");
		expect(me?.data?.role).toBe(50);

		const manifest = await expectOkJson(authedRequest, "/_emdash/api/manifest");
		for (const slug of ["pages", "posts", "projects"]) {
			expect(manifest?.data?.collections ?? {}).toHaveProperty(slug);
		}
		const plugins = manifest?.data?.plugins ?? {};
		const legacyBlocks =
			plugins["legacy-image-blocks"]?.portableTextBlocks ?? [];
		expect(legacyBlocks.map((block: { type: string }) => block.type)).toEqual(
			expect.arrayContaining(["legacyVideo", "legacyEmbed", "legacyPageList"]),
		);
		expect(
			legacyBlocks.map((block: { type: string }) => block.type),
		).not.toContain("legacyImage");
		const embedBlocks = plugins.embeds?.portableTextBlocks ?? [];
		expect(embedBlocks.map((block: { type: string }) => block.type)).toEqual(
			expect.arrayContaining(["youtube", "vimeo"]),
		);
		expect(plugins["audit-log"]?.adminPages ?? []).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "/history", label: "Audit History" }),
			]),
		);

		await expectOkJson(authedRequest, "/_emdash/api/dashboard");

		for (const slug of ["pages", "posts", "projects"]) {
			await expectOkJson(authedRequest, `/_emdash/api/content/${slug}?limit=1`);
			const authors = await expectOkJson(
				authedRequest,
				`/_emdash/api/content/${slug}/authors`,
			);
			expect(Array.isArray(authors?.data?.items)).toBe(true);
		}

		await expectOkJson(authedRequest, "/_emdash/api/media?limit=1");
		await expectOkJson(authedRequest, "/_emdash/api/media/providers");
	});
});
