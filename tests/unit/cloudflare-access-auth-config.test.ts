import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const config = readFileSync(
	new URL("../../astro.config.mjs", import.meta.url),
	"utf8",
);

describe("Cloudflare Access auth config", () => {
	test("uses Cloudflare Access without EmDash auto-provisioning", () => {
		expect(config).toMatch(/type:\s*"cloudflare-access"/);
		expect(config).toMatch(/autoProvision:\s*false/);
		expect(config).not.toMatch(/autoProvision:\s*true/);
	});

	test("guards the test auth provider behind an e2e-only opt-in", () => {
		expect(config).toMatch(/EMDASH_TEST_AUTH/);
		expect(config).toMatch(/EMDASH_ALLOW_TEST_AUTH/);
		expect(config).toMatch(/useTestAuth && !allowTestAuth/);
	});
});
