import { describe, expect, test } from "vitest";

import { cacheTagsForMutation } from "../../src/lib/cache-invalidation";

describe("shared cache invalidation", () => {
	test("invalidates settings and the rendered primary menu", () => {
		expect(cacheTagsForMutation("POST", "/_emdash/api/settings")).toEqual([
			"site-settings",
		]);
		expect(
			cacheTagsForMutation("POST", "/_emdash/api/menus/primary/items/123"),
		).toEqual(["menu:primary"]);
		expect(cacheTagsForMutation("POST", "/_emdash/api/menus")).toEqual([
			"menu:primary",
		]);
		expect(
			cacheTagsForMutation("POST", "/_emdash/api/menus/footer/items"),
		).toEqual([]);
	});

	test("invalidates taxonomy labels and content assignments", () => {
		expect(
			cacheTagsForMutation(
				"PUT",
				"/_emdash/api/taxonomies/category/terms/ethics",
			),
		).toEqual(["taxonomy:category"]);
		expect(
			cacheTagsForMutation(
				"POST",
				"/_emdash/api/content/projects/project-1/terms/topic",
			),
		).toEqual(["projects", "project-1", "taxonomy:topic"]);
	});

	test("ignores reads, failed path matches, and unrelated settings", () => {
		expect(cacheTagsForMutation("GET", "/_emdash/api/settings")).toEqual([]);
		expect(
			cacheTagsForMutation("PUT", "/_emdash/api/settings/backups"),
		).toEqual([]);
		expect(cacheTagsForMutation("POST", "/contact")).toEqual([]);
	});
});
