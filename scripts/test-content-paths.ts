import assert from "node:assert/strict";

import {
	derivePagePath,
	derivePostPath,
	deriveProjectPath,
} from "../src/lib/content-paths.ts";

assert.equal(derivePagePath("", "home"), "");
assert.equal(derivePagePath(null, "about"), "about");
assert.equal(
	derivePagePath("about-ce-projects/about-e-portfolios", "portfolio-examples"),
	"about-ce-projects/portfolio-examples",
);

assert.equal(
	derivePostPath("2022/05/31/jason-swartwood", "updated-post"),
	"2022/05/31/updated-post",
);
assert.equal(
	derivePostPath(null, "new-post", "2026-05-31T16:10:00.000Z"),
	"2026/05/31/new-post",
);
assert.equal(derivePostPath(null, "undated-post"), "undated-post");

assert.equal(
	deriveProjectPath("project/old-project", "new-project"),
	"project/new-project",
);
assert.equal(deriveProjectPath(null, "new-project"), "project/new-project");

console.log("Content path derivation tests passed.");
