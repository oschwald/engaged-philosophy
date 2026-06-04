import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";
import { validateSeed } from "emdash";

interface CheckedInSeed {
	collections?: Array<{ slug?: string }>;
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
