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
});
