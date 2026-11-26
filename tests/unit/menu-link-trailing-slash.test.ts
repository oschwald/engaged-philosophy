import { describe, expect, test } from "vitest";

import { canonicalSiteHref, isCurrentMenuLink } from "../../src/lib/path-utils";

describe("menu link trailing slash", () => {
	test("links site pages in the slash form", () => {
		expect(canonicalSiteHref("/project/foo")).toBe("/project/foo/");
		expect(canonicalSiteHref("/category/ethics")).toBe("/category/ethics/");
		expect(canonicalSiteHref("/about?ref=menu#team")).toBe(
			"/about/?ref=menu#team",
		);
		for (const href of [
			"/",
			"/about/",
			"/papers/lecture.pdf",
			"/wp-content/uploads/2014/02/paper.pdf",
			"/_emdash/admin",
			"#",
			"",
			"//cdn.example/x",
			"https://example.com/page",
			"mailto:someone@example.com",
		]) {
			expect(canonicalSiteHref(href), href).toBe(href);
		}
	});

	test("marks only the link to the current page as current", () => {
		expect(isCurrentMenuLink("/about/", "/about/")).toBe(true);
		expect(isCurrentMenuLink("/about", "/about/")).toBe(true);
		expect(isCurrentMenuLink("/", "/")).toBe(true);
		for (const href of [
			"/#contact",
			"/about/#team",
			"/?s=ethics",
			"/about/?ref=menu",
			"#",
			"",
			"/blog/",
		]) {
			expect(isCurrentMenuLink(href, "/about/"), href).toBe(false);
			expect(isCurrentMenuLink(href, "/"), href).toBe(false);
		}
		expect(isCurrentMenuLink("/about/", undefined)).toBe(false);
	});
});
