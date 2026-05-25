export const PROJECT_TAXONOMIES = [
	"topic",
	"schools",
	"professors",
	"courses",
	"semesters",
] as const;

export type ProjectTaxonomy = (typeof PROJECT_TAXONOMIES)[number];

export function isProjectTaxonomy(value: string): value is ProjectTaxonomy {
	return PROJECT_TAXONOMIES.includes(value as ProjectTaxonomy);
}

export function joinPath(parts: string[]) {
	return parts.filter(Boolean).join("/");
}

export function sortByPublishedOn<T extends { data: { published_on?: string; title?: string } }>(
	items: T[],
) {
	return [...items].sort((a, b) => {
		const dateA = a.data.published_on ? Date.parse(a.data.published_on) : 0;
		const dateB = b.data.published_on ? Date.parse(b.data.published_on) : 0;
		if (dateA !== dateB) return dateB - dateA;
		return (a.data.title ?? "").localeCompare(b.data.title ?? "");
	});
}

export function ensureTrailingSlash(value: string) {
	if (value === "/") return value;
	return value.endsWith("/") ? value : `${value}/`;
}

export function findEntryByPath<T extends { path?: string }>(
	items: Array<{ data: T }>,
	path: string,
) {
	return items.find((item) => item.data.path === path) ?? null;
}

export function getEntryDatabaseId<T extends { id?: string }>(item: { id: string; data: T }) {
	return item.data.id || item.id;
}

export function stripHtml(value?: string | null) {
	return (value ?? "")
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&#8211;/g, "–")
		.replace(/&#8212;/g, "—")
		.replace(/&#8217;/g, "’")
		.replace(/&#8220;/g, "“")
		.replace(/&#8221;/g, "”")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();
}

export function getExcerptText(
	excerptHtml?: string | null,
	contentHtml?: string | null,
	wordLimit = 55,
) {
	const preferred = stripHtml(excerptHtml);
	if (preferred) return preferred;

	const content = stripHtml(contentHtml);
	if (!content) return "";

	const words = content.split(/\s+/);
	return words.slice(0, wordLimit).join(" ");
}

export function formatPathDate(path?: string) {
	const parts = (path ?? "").split("/");
	if (parts.length < 3) return "";
	const [year, month, day] = parts;
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	if (Number.isNaN(date.valueOf())) return "";
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	});
}
