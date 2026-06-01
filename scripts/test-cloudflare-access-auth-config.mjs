import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = readFileSync(
	new URL("../astro.config.mjs", import.meta.url),
	"utf8",
);

assert.match(
	config,
	/type:\s*"cloudflare-access"/,
	"Expected Cloudflare Access auth to be enabled.",
);
assert.match(
	config,
	/autoProvision:\s*false/,
	"Cloudflare Access allows all verified identities; EmDash auto-provisioning must stay disabled.",
);
assert.doesNotMatch(
	config,
	/autoProvision:\s*true/,
	"Cloudflare Access must not auto-provision users while the Access policy includes Everyone.",
);

console.log("Cloudflare Access auth config guard passed.");
