import { beforeEach, describe, expect, test, vi } from "vitest";

const { getEmDashCollection, getEmDashEntry } = vi.hoisted(() => ({
	getEmDashCollection: vi.fn(),
	getEmDashEntry: vi.fn(),
}));

vi.mock("emdash", () => ({
	getEmDashCollection,
	getEmDashEntry,
	getMenu: vi.fn(),
	getSiteSettings: vi.fn(),
	getTaxonomyTerms: vi.fn(),
	getTerm: vi.fn(),
}));

import {
	getPageByPath,
	getPostsPageByCategory,
	getPublishedPages,
	getRecentPosts,
} from "../../src/lib/content";

function entry(id: string, data: Record<string, unknown>) {
	return { id, edit: {}, data };
}

describe("content queries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("queries only the requested archive page", async () => {
		getEmDashCollection.mockResolvedValue({
			entries: [
				entry("post-1", {
					slug: "first-post",
					path: "2026/01/02/first-post",
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
			orderBy: { published_on: "desc", title: "asc" },
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
			orderBy: { published_on: "desc", title: "asc" },
		});
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

	test("uses a targeted path query when a slug lookup does not match", async () => {
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
	});
});
