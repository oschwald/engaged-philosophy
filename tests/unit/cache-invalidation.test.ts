import { describe, expect, test } from "vitest";

import { cacheTagsForMutation } from "../../src/lib/cache-invalidation";

describe("shared cache invalidation", () => {
	test("leaves settings, menu, and taxonomy invalidation to EmDash", () => {
		for (const path of [
			"/_emdash/api/settings",
			"/_emdash/api/menus",
			"/_emdash/api/menus/primary/items/123",
			"/_emdash/api/taxonomies/category/terms/ethics",
		]) {
			expect(cacheTagsForMutation("POST", path)).toEqual([]);
		}
	});

	test("invalidates content assignments and their taxonomy pages", () => {
		expect(
			cacheTagsForMutation(
				"POST",
				"/_emdash/api/content/projects/project-1/terms/topic",
			),
		).toEqual(["projects", "project-1", "emdash:taxonomy:topic"]);
	});

	test("ignores reads, failed path matches, and unrelated settings", () => {
		expect(cacheTagsForMutation("GET", "/_emdash/api/settings")).toEqual([]);
		expect(
			cacheTagsForMutation("PUT", "/_emdash/api/settings/backups"),
		).toEqual([]);
		expect(cacheTagsForMutation("POST", "/contact")).toEqual([]);
	});
});
