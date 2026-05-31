import assert from "node:assert/strict";

import {
	derivePagePath,
	derivePostPath,
	deriveProjectPath,
} from "../src/lib/content-paths.ts";

assert.equal(derivePagePath("", "home"), "");
assert.equal(derivePagePath(null, "about"), "about");
assert.equal(derivePagePath("/about/", null), "about");
assert.equal(
	derivePagePath("about-ce-projects/about-e-portfolios", "portfolio-examples"),
	"about-ce-projects/portfolio-examples",
);
assert.equal(
	derivePagePath("/about-ce-projects/about-e-portfolios/", "/nested/leaf/"),
	"about-ce-projects/leaf",
);

assert.equal(
	derivePostPath("2022/05/31/jason-swartwood", "updated-post"),
	"2022/05/31/updated-post",
);
assert.equal(
	derivePostPath("/2022/05/31/jason-swartwood/", null),
	"2022/05/31/jason-swartwood",
);
assert.equal(
	derivePostPath(null, "new-post", "2026-05-31T16:10:00.000Z"),
	"2026/05/31/new-post",
);
assert.equal(
	derivePostPath(null, "published-post", null, "2025-04-03T11:00:00.000Z"),
	"2025/04/03/published-post",
);
assert.equal(
	derivePostPath(null, "created-post", null, null, "2024-03-02T11:00:00.000Z"),
	"2024/03/02/created-post",
);
assert.equal(derivePostPath(null, "undated-post"), "undated-post");

assert.equal(
	deriveProjectPath("project/old-project", "new-project"),
	"project/new-project",
);
assert.equal(deriveProjectPath(null, "new-project"), "project/new-project");
assert.equal(
	deriveProjectPath("/project/current-project/", null),
	"project/current-project",
);

console.log("Content path derivation tests passed.");
