import { test, expect } from "../../fixtures/worker";
import {
	createAndPublishContentViaApi,
	createTaxonomyTermViaApi,
	deleteContentViaApi,
	deleteTaxonomyTermViaApi,
	uniqueTitle,
} from "../../support/content";

test("renders taxonomy terms hydrated onto public entries", async ({
	authedRequest,
	publicPage,
}, testInfo) => {
	const postTitle = uniqueTitle("E2E Hydrated Post Terms", testInfo.testId);
	const projectTitle = uniqueTitle(
		"E2E Hydrated Project Terms",
		testInfo.testId,
	);
	const terms = [
		{ taxonomy: "category", slug: "e2e-category", label: "E2E Category" },
		{ taxonomy: "schools", slug: "e2e-school", label: "E2E College" },
		{
			taxonomy: "professors",
			slug: "e2e-professor",
			label: "E2E Professor",
		},
		{ taxonomy: "courses", slug: "e2e-course", label: "E2E Course" },
		{
			taxonomy: "semesters",
			slug: "e2e-semester",
			label: "E2E Semester",
		},
		{ taxonomy: "topic", slug: "e2e-topic-one", label: "E2E Topic One" },
		{ taxonomy: "topic", slug: "e2e-topic-two", label: "E2E Topic Two" },
	];

	for (const { taxonomy, slug, label } of terms) {
		await createTaxonomyTermViaApi(authedRequest, taxonomy, { slug, label });
	}

	const post = await createAndPublishContentViaApi(authedRequest, "posts", {
		title: postTitle,
		publishedAt: "2026-07-25T12:00:00.000Z",
		taxonomies: {
			category: ["e2e-category"],
		},
	});
	const project = await createAndPublishContentViaApi(
		authedRequest,
		"projects",
		{
			title: projectTitle,
			taxonomies: {
				schools: ["e2e-school"],
				professors: ["e2e-professor"],
				courses: ["e2e-course"],
				semesters: ["e2e-semester"],
				topic: ["e2e-topic-one", "e2e-topic-two"],
			},
		},
	);

	try {
		await publicPage.goto(post.publicPath, {
			waitUntil: "domcontentloaded",
		});
		const categoryFooter = publicPage.locator(".cat-links");
		await expect(categoryFooter).toContainText("Posted in");
		await expect(
			categoryFooter.getByRole("link", { name: "E2E Category" }),
		).toHaveAttribute("href", "/category/e2e-category/");

		await publicPage.goto("/category/e2e-category/", {
			waitUntil: "domcontentloaded",
		});
		await expect(
			publicPage.getByRole("heading", {
				name: "Category Archives: E2E Category",
			}),
		).toBeVisible();
		await expect(
			publicPage
				.locator("#content")
				.getByRole("link", { name: postTitle, exact: true }),
		).toHaveAttribute("href", post.publicPath);

		await publicPage.goto(project.publicPath, {
			waitUntil: "domcontentloaded",
		});
		const termList = publicPage.locator(".entry-content .well");
		await expect(termList).toContainText("College");
		await expect(
			termList.getByRole("link", { name: "E2E College" }),
		).toHaveAttribute("href", "/schools/e2e-school/");
		await expect(
			termList.getByRole("link", { name: "E2E Professor" }),
		).toHaveAttribute("href", "/professors/e2e-professor/");
		await expect(
			termList.getByRole("link", { name: "E2E Course" }),
		).toHaveAttribute("href", "/courses/e2e-course/");
		await expect(
			termList.getByRole("link", { name: "E2E Semester" }),
		).toHaveAttribute("href", "/semesters/e2e-semester/");
		await expect(
			termList.getByRole("link", { name: "E2E Topic One" }),
		).toHaveAttribute("href", "/topic/e2e-topic-one/");
		await expect(
			termList.getByRole("link", { name: "E2E Topic Two" }),
		).toHaveAttribute("href", "/topic/e2e-topic-two/");

		await publicPage.goto("/topic/e2e-topic-one/", {
			waitUntil: "domcontentloaded",
		});
		await expect(
			publicPage.getByRole("heading", {
				name: "Project Topic: E2E Topic One",
			}),
		).toBeVisible();
		await expect(
			publicPage.getByRole("heading", { name: projectTitle, exact: true }),
		).toBeVisible();
		await expect(
			publicPage.getByRole("link", { name: /Continue reading/ }),
		).toHaveAttribute("href", project.publicPath);
	} finally {
		await deleteContentViaApi(authedRequest, "posts", post.published.id);
		await deleteContentViaApi(authedRequest, "projects", project.published.id);
		for (const { taxonomy, slug } of terms.toReversed()) {
			await deleteTaxonomyTermViaApi(authedRequest, taxonomy, slug);
		}
	}
});
