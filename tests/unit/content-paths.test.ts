import { describe, expect, test } from "vitest";

import {
	derivePagePath,
	derivePostPath,
	projectPath,
} from "../../src/lib/content-paths";

describe("content path derivation", () => {
	test("derives page paths from existing hierarchy and slug overrides", () => {
		expect(derivePagePath("", "home")).toBe("");
		expect(derivePagePath(null, "about")).toBe("about");
		expect(derivePagePath("/about/", null)).toBe("about");
		expect(
			derivePagePath(
				"about-ce-projects/about-e-portfolios",
				"portfolio-examples",
			),
		).toBe("about-ce-projects/portfolio-examples");
		expect(
			derivePagePath("/about-ce-projects/about-e-portfolios/", "/nested/leaf/"),
		).toBe("about-ce-projects/leaf");
	});

	test("derives dated post paths from path and native publication dates", () => {
		expect(derivePostPath("2022/05/31/jason-swartwood", "updated-post")).toBe(
			"2022/05/31/updated-post",
		);
		expect(derivePostPath("/2022/05/31/jason-swartwood/", null)).toBe(
			"2022/05/31/jason-swartwood",
		);
		expect(derivePostPath(null, "new-post", "2026-05-31T16:10:00.000Z")).toBe(
			"2026/05/31/new-post",
		);
		expect(
			derivePostPath(null, "published-post", "2025-04-03T11:00:00.000Z"),
		).toBe("2025/04/03/published-post");
		expect(
			derivePostPath(null, "created-post", null, "2024-03-02T11:00:00.000Z"),
		).toBe("2024/03/02/created-post");
		expect(derivePostPath(null, "undated-post")).toBe("undated-post");
	});

	test("builds project paths from the native URL pattern", () => {
		expect(projectPath("new-project")).toBe("project/new-project");
		expect(projectPath("/nested/current-project/")).toBe(
			"project/current-project",
		);
		expect(projectPath(null)).toBe("project");
	});
});
