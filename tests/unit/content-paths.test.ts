import { describe, expect, test } from "vitest";

import {
	derivePagePath,
	postPath,
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

	test("builds post URLs from the UTC publication date", () => {
		expect(postPath("published-post", "2025-04-03T11:00:00.000Z")).toBe(
			"2025/04/03/published-post",
		);
		expect(postPath("midnight", "2022-06-01T00:12:21.000Z")).toBe(
			"2022/06/01/midnight",
		);
		expect(postPath("sqlite-date", "2025-04-03 23:00:00")).toBe(
			"2025/04/03/sqlite-date",
		);
		expect(postPath("café", "2025-04-03T11:00:00.000Z")).toBe(
			"2025/04/03/caf%C3%A9",
		);
		expect(postPath("undated-post")).toBe("");
		expect(postPath("invalid-date", "invalid")).toBe("");
		expect(postPath(null, "2025-04-03T11:00:00.000Z")).toBe("");
	});

	test("builds project paths from the native URL pattern", () => {
		expect(projectPath("new-project")).toBe("project/new-project");
		expect(projectPath("/nested/current-project/")).toBe(
			"project/current-project",
		);
		expect(projectPath(null)).toBe("project");
	});
});
