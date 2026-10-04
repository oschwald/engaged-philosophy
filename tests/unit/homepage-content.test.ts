import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";

// Execute the route's data-loading code; the HTML template needs a Worker.
const frontmatter = readFileSync("src/pages/index.astro", "utf8")
	.split("---")[1]
	.replace(/^import[\s\S]*?;\n/gm, "");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

test("search requests do not load homepage content or highlights", async () => {
	const getPageBySlug = vi.fn().mockResolvedValue(null);
	const getHighlightedProjects = vi.fn().mockResolvedValue({ entries: [] });
	const searchSite = vi.fn().mockResolvedValue({ results: [] });
	await new AsyncFunction(
		"Astro",
		"getPageBySlug",
		"getHighlightedProjects",
		"searchSite",
		frontmatter,
	)(
		{ url: new URL("https://example.test/?s=community") },
		getPageBySlug,
		getHighlightedProjects,
		searchSite,
	);
	expect(searchSite).toHaveBeenCalledWith("community");
	expect(getPageBySlug).not.toHaveBeenCalled();
	expect(getHighlightedProjects).not.toHaveBeenCalled();
});

test.each(["", "?s=%20%20"])(
	"loads homepage content for blank searches (%s)",
	async (search) => {
		const getPageBySlug = vi.fn().mockResolvedValue(null);
		const getHighlightedProjects = vi.fn().mockResolvedValue({ entries: [] });
		const searchSite = vi.fn();
		await new AsyncFunction(
			"Astro",
			"getPageBySlug",
			"getHighlightedProjects",
			"searchSite",
			frontmatter,
		)(
			{ url: new URL(`https://example.test/${search}`) },
			getPageBySlug,
			getHighlightedProjects,
			searchSite,
		);
		expect(getPageBySlug).toHaveBeenCalledWith("home");
		expect(getHighlightedProjects).toHaveBeenCalledOnce();
		expect(searchSite).not.toHaveBeenCalled();
	},
);
