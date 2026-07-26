import { test, expect } from "../../fixtures/worker";

const MISSING_ROUTES = [
	{ kind: "page", path: "/e2e-missing-page/" },
	{ kind: "dated post", path: "/2099/12/31/e2e-missing-post/" },
	{ kind: "project", path: "/project/e2e-missing-project/" },
	{ kind: "category", path: "/category/e2e-missing-category/" },
	{ kind: "taxonomy", path: "/schools/e2e-missing-school/" },
	{ kind: "search pagination", path: "/page/2/" },
	{
		kind: "category pagination",
		path: "/category/e2e-missing-category/page/2/",
	},
	{
		kind: "taxonomy pagination",
		path: "/schools/e2e-missing-school/page/2/",
	},
	{ kind: "page alias", path: "/pages/e2e-missing-page/" },
	{ kind: "post alias", path: "/posts/e2e-missing-post/" },
	{ kind: "project alias", path: "/projects/e2e-missing-project/" },
] as const;

test.describe("public not-found responses", () => {
	for (const { kind, path } of MISSING_ROUTES) {
		test(`${kind} stays at the requested URL`, async ({ publicPage }) => {
			const response = await publicPage.goto(path, {
				waitUntil: "domcontentloaded",
			});

			expect(response?.status()).toBe(404);
			expect(response?.headers().location).toBeUndefined();
			expect(new URL(publicPage.url()).pathname).toBe(path);
			await expect(
				publicPage.getByRole("heading", {
					name: "This is somewhat embarrassing, isn\u2019t it?",
				}),
			).toBeVisible();
		});
	}

	test("EmDash logs the originally requested path", async ({
		authedRequest,
		publicPage,
	}) => {
		const path = "/e2e-original-404-log-path/";
		const response = await publicPage.goto(path);
		expect(response?.status()).toBe(404);
		const cacheTags = response?.headers()["cache-tag"]?.split(",") ?? [];
		expect(cacheTags).toEqual(
			expect.arrayContaining([
				"pages",
				"posts",
				"projects",
				"taxonomy:category",
				"taxonomy:topic",
				"taxonomy:schools",
				"taxonomy:professors",
				"taxonomy:courses",
				"taxonomy:semesters",
			]),
		);

		await expect
			.poll(async () => {
				const logResponse = await authedRequest.get(
					`/_emdash/api/redirects/404s?search=${encodeURIComponent(path)}`,
				);
				expect(logResponse.ok()).toBe(true);
				const body = (await logResponse.json()) as {
					data?: { items?: Array<{ path?: string }> };
				};
				return body.data?.items?.map((entry) => entry.path) ?? [];
			})
			.toContain(path);

		const rewrittenPathResponse = await authedRequest.get(
			`/_emdash/api/redirects/404s?search=${encodeURIComponent("/404")}`,
		);
		expect(rewrittenPathResponse.ok()).toBe(true);
		const rewrittenPathBody = (await rewrittenPathResponse.json()) as {
			data?: { items?: Array<{ path?: string }> };
		};
		expect(
			rewrittenPathBody.data?.items?.map((entry) => entry.path) ?? [],
		).not.toContain("/404");
	});
});
