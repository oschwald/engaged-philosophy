import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateSeed } from "emdash";

const seed = JSON.parse(readFileSync(".emdash/seed.json", "utf8"));
const validation = validateSeed(seed);

assert.equal(
	validation.valid,
	true,
	`Expected .emdash/seed.json to be valid: ${validation.errors.join(", ")}`,
);
assert.equal(
	Object.hasOwn(seed, "content"),
	false,
	"Checked-in seed should be schema/config only, not content.",
);

const collectionSlugs = new Set(
	seed.collections?.map((collection) => collection.slug),
);
for (const slug of ["pages", "posts", "projects"]) {
	assert.equal(collectionSlugs.has(slug), true, `Missing ${slug} collection`);
}

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
	assert.equal(
		pattern.test(serialized),
		false,
		`Checked-in seed appears to contain sensitive data matching ${pattern}`,
	);
}

console.log("Seed guard passed.");
