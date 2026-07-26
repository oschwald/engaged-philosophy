import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";
import { validateSeed } from "emdash";

interface CheckedInSeed {
	settings?: {
		url?: string;
		timezone?: string;
		dateFormat?: string;
	};
	collections?: Array<{
		slug?: string;
		supports?: string[];
		urlPattern?: string;
		fields?: Array<{ slug?: string; searchable?: boolean; widget?: string }>;
	}>;
	content?: unknown;
	[key: string]: unknown;
}

describe("checked-in EmDash seed", () => {
	const seed = JSON.parse(
		readFileSync(".emdash/seed.json", "utf8"),
	) as CheckedInSeed;

	test("is a valid schema/config seed", () => {
		const validation = validateSeed(seed);

		expect(
			validation.valid,
			`Expected .emdash/seed.json to be valid: ${validation.errors.join(", ")}`,
		).toBe(true);
	});

	test("does not include exported content", () => {
		expect(
			Object.hasOwn(seed, "content"),
			"Checked-in seed should be schema/config only, not content.",
		).toBe(false);
	});

	test("defines the native public site presentation settings", () => {
		expect(seed.settings).toMatchObject({
			url: "https://www.engagedphilosophy.com",
			timezone: "America/Los_Angeles",
			dateFormat: "MMMM d, yyyy",
		});
	});

	test("keeps the content collections required by the theme", () => {
		const collectionSlugs = new Set(
			seed.collections?.map((collection) => collection.slug),
		);

		for (const slug of ["pages", "posts", "projects"]) {
			expect(collectionSlugs.has(slug), `Missing ${slug} collection`).toBe(
				true,
			);
		}
	});

	test("uses the native project URL pattern", () => {
		const projects = seed.collections?.find(
			(collection) => collection.slug === "projects",
		);

		expect(projects?.urlPattern).toBe("/project/{slug}");
		expect(projects?.fields?.map((field) => field.slug)).not.toContain("path");
	});

	test("omits unused WordPress migration fields", () => {
		for (const slug of ["pages", "posts", "projects"]) {
			const collection = seed.collections?.find(
				(candidate) => candidate.slug === slug,
			);
			expect(collection, `Missing ${slug} collection`).toBeDefined();
			expect(
				collection?.fields?.length,
				`Missing fields for ${slug} collection`,
			).toBeGreaterThan(0);
			const fieldSlugs = collection?.fields?.map((field) => field.slug);
			expect(fieldSlugs).not.toContain("legacy_wp_id");
			if (slug === "pages") {
				expect(fieldSlugs).not.toContain("about_html");
			}
		}
	});

	test("indexes the public search fields", () => {
		for (const collection of seed.collections ?? []) {
			if (!["pages", "posts", "projects"].includes(collection.slug ?? "")) {
				continue;
			}

			expect(collection.supports).toContain("search");
			const searchableFields = new Set(
				collection.fields
					?.filter((field) => field.searchable)
					.map((field) => field.slug),
			);
			const expectedFields =
				collection.slug === "pages"
					? ["title", "content"]
					: ["title", "excerpt", "content"];

			expect(searchableFields).toEqual(new Set(expectedFields));
		}
	});

	test("does not contain obvious credentials or user exports", () => {
		const serialized = JSON.stringify(seed);
		for (const pattern of [
			/ec_pat_/,
			/CF_Authorization/,
			/auth_token/i,
			/api_token/i,
			/credential/i,
			/password/i,
			/secret/i,
			/"users"/i,
		]) {
			expect(
				pattern.test(serialized),
				`Checked-in seed appears to contain sensitive data matching ${pattern}`,
			).toBe(false);
		}
	});
});
