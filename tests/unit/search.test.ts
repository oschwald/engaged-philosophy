import { beforeEach, describe, expect, test, vi } from "vitest";

const { emdashSearch, getPublishedEntriesByIds } = vi.hoisted(() => ({
	emdashSearch: vi.fn(),
	getPublishedEntriesByIds: vi.fn(),
}));

vi.mock("emdash", () => ({ search: emdashSearch }));
vi.mock("../../src/lib/content", () => ({ getPublishedEntriesByIds }));

import { searchSite } from "../../src/lib/search";

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
							id: "project-1",
							edit: {},
							data: {
								title: "Project One",
								path: "project/project-one",
							},
						},
					];
				}
				return [
					{
						id: "page-1",
						edit: {},
						data: { title: "About", path: "about" },
					},
				];
			},
		);

		const result = await searchSite(
			"community",
			"current-page",
			"https://media.example.com",
		);

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
});
