import { beforeEach, describe, expect, test, vi } from "vitest";

const {
	cachedQuery,
	getRequestContext,
	getEmDashCollection,
	getEmDashEntry,
	getTerm,
} = vi.hoisted(() => ({
	cachedQuery: vi.fn(),
	getRequestContext: vi.fn(),
	getEmDashCollection: vi.fn(),
	getEmDashEntry: vi.fn(),
	getTerm: vi.fn(),
}));

vi.mock("emdash", () => ({
	cachedQuery,
	contentNamespaces: (collection: string) => [`content:${collection}`],
	getRequestContext,
	getEmDashCollection,
	getEmDashEntry,
	getTaxonomyTerms: vi.fn(),
	getTerm,
}));

import {
	getHighlightedProjects,
	getPageByPath,
	getPostByPath,
	getPostsPageByCategory,
	getPublishedPages,
	getRecentPosts,
	getTaxonomyTerm,
} from "../../src/lib/content";

function entry(id: string, data: Record<string, unknown>) {
	return { id, edit: {}, data };
}

describe("content retrieval and taxonomy", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		cachedQuery.mockImplementation(({ load }) => load());
	});

	test("queries only the requested archive page", async () => {
		getEmDashCollection.mockResolvedValue({
			entries: [
				entry("post-1", {
					slug: "first-post",
					path: "1999/01/01/obsolete-path",
					publishedAt: new Date("2026-01-02T12:00:00Z"),
					title: "First post",
				}),
			],
			hasMore: true,
			cacheHint: { tags: ["posts"] },
		});

		const result = await getPostsPageByCategory("news", 3, 10);

		expect(getEmDashCollection).toHaveBeenCalledWith("posts", {
			status: "published",
			limit: 10,
			offset: 20,
			where: { category: "news" },
			orderBy: { published_at: "desc", title: "asc" },
		});
		expect(result).toMatchObject({
			hasMore: true,
			entries: [{ id: "post-1" }],
		});
	});

	test("limits recent-post queries at the database", async () => {
		getEmDashCollection.mockResolvedValue({
			entries: [],
			hasMore: false,
			cacheHint: {},
		});

		await getRecentPosts(25);

		expect(getEmDashCollection).toHaveBeenCalledWith("posts", {
			status: "published",
			limit: 25,
			orderBy: { published_at: "desc", title: "asc" },
		});
	});

	test("normalizes light and dark featured images for every collection", async () => {
		getEmDashCollection.mockResolvedValue({
			entries: [
				entry("entry-1", {
					slug: "featured-entry",
					path: "2026/01/02/featured-entry",
					title: "Featured entry",
					featured_image: {
						provider: "local",
						meta: {
							storageKey: "wp-content/uploads/2026/01/featured.jpg",
						},
						alt: "Featured",
						filename: "featured.jpg",
						mimeType: "image/jpeg",
						blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
						dominantColor: "#4b8f8c",
						darkVariant: {
							provider: "local",
							meta: {
								storageKey: "wp-content/uploads/2026/01/featured-dark.webp",
							},
							alt: "Featured at night",
							filename: "featured-dark.webp",
							mimeType: "image/webp",
							blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
							dominantColor: "#172133",
						},
					},
				}),
			],
			hasMore: false,
			cacheHint: {},
		});

		const pages = await getPublishedPages();
		const posts = await getRecentPosts(1);
		const projects = await getHighlightedProjects(1);

		for (const normalizedEntry of [
			pages[0],
			posts.entries[0],
			projects.entries[0],
		]) {
			expect(normalizedEntry).toMatchObject({
				data: {
					featured_image: {
						src: "https://media.engagedphilosophy.com/wp-content/uploads/2026/01/featured.jpg",
						alt: "Featured",
						filename: "featured.jpg",
						mimeType: "image/jpeg",
						blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
						dominantColor: "#4b8f8c",
						darkVariant: {
							src: "https://media.engagedphilosophy.com/wp-content/uploads/2026/01/featured-dark.webp",
							alt: "Featured at night",
							filename: "featured-dark.webp",
							mimeType: "image/webp",
							blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
							dominantColor: "#172133",
						},
					},
				},
			});
		}
	});

	test("walks collection cursors instead of truncating full listings", async () => {
		getEmDashCollection
			.mockResolvedValueOnce({
				entries: [entry("page-1", { slug: "one", path: "one" })],
				nextCursor: "next-page",
				cacheHint: {},
			})
			.mockResolvedValueOnce({
				entries: [entry("page-2", { slug: "two", path: "two" })],
				cacheHint: {},
			});

		await expect(getPublishedPages()).resolves.toHaveLength(2);
		expect(getEmDashCollection).toHaveBeenNthCalledWith(2, "pages", {
			status: "published",
			limit: 1000,
			cursor: "next-page",
		});
	});

	test("resolves a published nested path before fetching its entry", async () => {
		const child = entry("page-1", {
			slug: "child",
			path: "parent/child",
			title: "Child",
		});
		getEmDashCollection.mockResolvedValue({ entries: [child] });
		getEmDashEntry.mockResolvedValue({ entry: child });

		await expect(getPageByPath("/parent/child/")).resolves.toMatchObject({
			id: "page-1",
		});
		expect(getEmDashEntry).toHaveBeenCalledWith("pages", "page-1");
		expect(getEmDashCollection).toHaveBeenCalledWith("pages", {
			status: "published",
			limit: 1000,
			cursor: undefined,
		});
	});

	test("does not query arbitrary slugs or paths for missing nested pages", async () => {
		getEmDashCollection.mockResolvedValue({ entries: [] });
		for (const path of ["missing/one", "missing/two", "constructor/toString"]) {
			await expect(getPageByPath(path)).resolves.toBeNull();
		}
		expect(getEmDashEntry).not.toHaveBeenCalled();
		for (const [, filter] of getEmDashCollection.mock.calls) {
			expect(filter.where).toBeUndefined();
		}
		expect(
			new Set(cachedQuery.mock.calls.map(([options]) => options.key)).size,
		).toBe(1);
	});

	test("indexes all pages and uses the canonical path after a slug rename", async () => {
		const child = entry("page-2", { slug: "renamed", path: "parent/old" });
		getEmDashCollection
			.mockResolvedValueOnce({
				entries: [entry("page-1", { slug: "about" })],
				nextCursor: "next",
			})
			.mockResolvedValueOnce({ entries: [child] });
		getEmDashEntry.mockResolvedValue({ entry: child });
		await expect(getPageByPath("parent/renamed")).resolves.toMatchObject({
			id: "page-2",
			data: { path: "parent/renamed" },
		});
		expect(getEmDashCollection).toHaveBeenLastCalledWith("pages", {
			status: "published",
			limit: 1000,
			cursor: "next",
		});
	});

	test("preserves stored-path aliases for canonical redirects", async () => {
		const child = entry("page-1", { slug: "renamed", path: "parent/old" });
		getEmDashCollection.mockResolvedValue({ entries: [child] });
		getEmDashEntry.mockResolvedValue({ entry: child });
		await expect(getPageByPath("parent/old")).resolves.toMatchObject({
			id: "page-1",
			data: { path: "parent/renamed" },
		});
	});

	test("prefers a canonical path over another page's stored alias", async () => {
		const canonical = entry("page-2", { slug: "old", path: "parent/old" });
		getEmDashCollection.mockResolvedValue({
			entries: [
				entry("page-1", { slug: "renamed", path: "parent/old" }),
				canonical,
			],
		});
		getEmDashEntry.mockResolvedValue({ entry: canonical });
		await expect(getPageByPath("parent/old")).resolves.toMatchObject({
			id: "page-2",
		});
		expect(getEmDashEntry).toHaveBeenCalledWith("pages", "page-2");
	});

	test("does not turn a failed index load into a missing page", async () => {
		getEmDashCollection
			.mockResolvedValueOnce({
				entries: [entry("page-1", { slug: "child", path: "parent/child" })],
				nextCursor: "next",
			})
			.mockResolvedValueOnce({
				entries: [],
				error: { message: "Database unavailable" },
			});
		await expect(getPageByPath("parent/child")).rejects.toThrow(
			"Database unavailable",
		);
		expect(getEmDashEntry).not.toHaveBeenCalled();
	});

	test("rejects a stale path index when an entry moves or disappears", async () => {
		cachedQuery.mockResolvedValue([{ path: "parent/old", id: "page-1" }]);
		getEmDashEntry
			.mockResolvedValueOnce({
				entry: entry("page-1", { slug: "new", path: "other/new" }),
			})
			.mockResolvedValueOnce({ entry: null });
		await expect(getPageByPath("parent/old")).resolves.toBeNull();
		await expect(getPageByPath("parent/old")).resolves.toBeNull();
		expect(getEmDashCollection).not.toHaveBeenCalled();
	});

	test.each([
		{ editMode: true },
		{ editMode: false, preview: { collection: "pages", id: "page-1" } },
		{ editMode: false, locale: "fr" },
		{ editMode: false, dbIsIsolated: true },
	])(
		"retains live nested-page lookup for request context %j",
		async (context) => {
			getRequestContext.mockReturnValue(context);
			getEmDashEntry.mockResolvedValue({ entry: null });
			getEmDashCollection.mockResolvedValue({
				entries: [
					entry("page-1", {
						slug: "child",
						path: "parent/child",
						title: "Child",
					}),
				],
				cacheHint: {},
			});

			await expect(getPageByPath("parent/child")).resolves.toMatchObject({
				id: "page-1",
			});
			expect(getEmDashCollection).toHaveBeenCalledWith("pages", {
				status: "published",
				limit: 1,
				where: { path: "parent/child" },
			});
			expect(cachedQuery).not.toHaveBeenCalled();
		},
	);

	test("preserves taxonomy terms hydrated by EmDash", async () => {
		getEmDashEntry.mockResolvedValue({
			entry: entry("post-1", {
				slug: "first-post",
				path: "1999/01/01/obsolete-path",
				publishedAt: new Date("2026-01-02T12:00:00Z"),
				title: "First post",
				terms: {
					category: [
						{ slug: "ethics", label: "Ethics" },
						{ slug: "teaching", label: "Teaching" },
					],
				},
			}),
		});

		await expect(getPostByPath("2026/01/02/first-post")).resolves.toMatchObject(
			{
				data: {
					terms: {
						category: [
							{ slug: "ethics", label: "Ethics" },
							{ slug: "teaching", label: "Teaching" },
						],
					},
				},
			},
		);
	});

	test("rejects dates that do not match a post without querying stored paths", async () => {
		getEmDashEntry.mockResolvedValue({
			entry: entry("post-1", {
				slug: "first-post",
				path: "1999/01/01/first-post",
				publishedAt: new Date("2026-01-02T12:00:00Z"),
			}),
		});
		await expect(getPostByPath("1999/01/01/first-post")).resolves.toBeNull();
		await expect(getPostByPath("2026/01/03/first-post")).resolves.toBeNull();
		expect(getEmDashCollection).not.toHaveBeenCalled();
	});

	test("resolves archive terms without aggregating usage counts", async () => {
		getTerm.mockResolvedValue({
			slug: "ethics",
			label: "Ethics",
			children: [],
		});

		await expect(getTaxonomyTerm("topic", "ethics")).resolves.toMatchObject({
			slug: "ethics",
			label: "Ethics",
		});
		expect(getTerm).toHaveBeenCalledWith("topic", "ethics", {
			includeCounts: false,
		});
	});
});
