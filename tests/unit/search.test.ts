import { beforeEach, describe, expect, test, vi } from "vitest";

const { emdashSearch, getPublishedEntriesByIds } = vi.hoisted(() => ({
	emdashSearch: vi.fn(),
	getPublishedEntriesByIds: vi.fn(),
}));

vi.mock("emdash", () => ({ search: emdashSearch }));
vi.mock("../../src/lib/content", () => ({ getPublishedEntriesByIds }));

import {
	isValidSearchCursor,
	isValidSearchCursorHistory,
	isValidSearchQuery,
	MAX_SEARCH_CURSOR_LENGTH,
	MAX_SEARCH_QUERY_LENGTH,
	MAX_SEARCH_CURSOR_HISTORY,
	searchCursorHistoryForNextPage,
	searchSite,
} from "../../src/lib/search";

describe("site search", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("does not query EmDash for a blank search", async () => {
		await expect(searchSite("  ")).resolves.toEqual({
			query: "",
			results: [],
		});
		expect(emdashSearch).not.toHaveBeenCalled();
	});

	test("rejects overlong search inputs before querying EmDash", async () => {
		const query = "x".repeat(MAX_SEARCH_QUERY_LENGTH + 1);
		const cursor = "x".repeat(MAX_SEARCH_CURSOR_LENGTH + 1);

		expect(isValidSearchQuery(query)).toBe(false);
		expect(isValidSearchCursor(cursor)).toBe(false);
		await expect(searchSite(query)).resolves.toEqual({
			query,
			results: [],
		});
		await expect(searchSite("valid", cursor)).resolves.toEqual({
			query: "valid",
			results: [],
		});
		expect(emdashSearch).not.toHaveBeenCalled();
	});

	test("uses EmDash FTS and hydrates only matching entries", async () => {
		emdashSearch.mockResolvedValue({
			items: [
				{ collection: "projects", id: "project-1", score: 10 },
				{ collection: "pages", id: "page-1", score: 8 },
			],
			nextCursor: "next-page",
		});
		getPublishedEntriesByIds.mockImplementation(
			async (collection: string, ids: string[]) => {
				if (ids.length === 0) return [];
				if (collection === "projects") {
					return [
						{
							id: "project-one",
							edit: {},
							data: {
								id: "project-1",
								slug: "project-one",
								title: "Project One",
								featured_image: {
									src: "https://media.example.com/project-one.jpg",
									alt: "Project One",
								},
							},
						},
					];
				}
				return [
					{
						id: "about",
						edit: {},
						data: { id: "page-1", title: "About", path: "about" },
					},
				];
			},
		);

		const result = await searchSite("community", "current-page");

		expect(emdashSearch).toHaveBeenCalledWith("community", {
			collections: ["pages", "posts", "projects"],
			status: "published",
			limit: 10,
			cursor: "current-page",
		});
		expect(result).toMatchObject({
			query: "community",
			nextCursor: "next-page",
			results: [
				{
					id: "project-1",
					kind: "project",
					title: "Project One",
					path: "project/project-one",
					imageSrc: "https://media.example.com/project-one.jpg",
				},
				{
					id: "page-1",
					kind: "page",
					title: "About",
					path: "about",
				},
			],
		});
	});

	test("includes the home page and drops other entries without a path", async () => {
		emdashSearch.mockResolvedValue({
			items: [
				{ collection: "pages", id: "page-home", score: 10 },
				{ collection: "pages", id: "page-nested-home", score: 9 },
				{ collection: "pages", id: "page-orphan", score: 8 },
				{ collection: "posts", id: "post-undated", score: 7 },
			],
		});
		getPublishedEntriesByIds.mockImplementation(
			async (collection: string, ids: string[]) => {
				if (ids.length === 0) return [];
				if (collection === "pages") {
					return [
						{
							id: "01HOMEPAGEULID",
							edit: {},
							data: {
								id: "page-home",
								slug: "home",
								title: "Welcome",
								path: "",
							},
						},
						{
							id: "01NESTEDHOMEULID",
							edit: {},
							data: {
								id: "page-nested-home",
								slug: "home",
								title: "Program Home",
								path: "programs/home",
							},
						},
						{
							id: "01ORPHANULID",
							edit: {},
							data: {
								id: "page-orphan",
								slug: "parent/home",
								title: "Orphan",
								path: "",
							},
						},
					];
				}
				return [
					{
						id: "undated-post",
						edit: {},
						data: { id: "post-undated", title: "Undated", path: "" },
					},
				];
			},
		);

		const result = await searchSite("welcome");

		expect(result.results).toEqual([
			expect.objectContaining({
				id: "page-home",
				kind: "page",
				title: "Welcome",
				path: "",
			}),
			expect.objectContaining({
				id: "page-nested-home",
				kind: "page",
				title: "Program Home",
				path: "programs/home",
			}),
		]);
	});

	test("bounds cursor history and requires it to match the page", () => {
		expect(searchCursorHistoryForNextPage([], undefined)).toEqual([""]);
		expect(isValidSearchCursorHistory(2, [""])).toBe(true);
		expect(isValidSearchCursorHistory(3, [""])).toBe(false);

		const maximumHistory = Array.from(
			{ length: MAX_SEARCH_CURSOR_HISTORY },
			(_, index) => `cursor-${index}`,
		);
		expect(
			isValidSearchCursorHistory(MAX_SEARCH_CURSOR_HISTORY + 1, maximumHistory),
		).toBe(true);
		expect(
			searchCursorHistoryForNextPage(maximumHistory, "one-too-many"),
		).toBeNull();
		expect(
			isValidSearchCursorHistory(MAX_SEARCH_CURSOR_HISTORY + 2, [
				...maximumHistory,
				"one-too-many",
			]),
		).toBe(false);
	});
});
