type DateValue = Date | string | number | null | undefined;

// Canonical URL rules mirror the migrated WordPress shape:
// pages keep their existing parent path and replace only the leaf slug,
// posts live under YYYY/MM/DD, and projects use EmDash's /project/{slug}
// collection URL pattern.
export function normalizeContentPath(path?: string | null) {
	return (path ?? "").replace(/^\/+|\/+$/g, "");
}

export function slugFromPath(path?: string | null) {
	return normalizeContentPath(path).split("/").filter(Boolean).at(-1) ?? "";
}

function prefixFromPath(path?: string | null) {
	const segments = normalizeContentPath(path).split("/").filter(Boolean);
	segments.pop();
	return segments;
}

function datePartsFromValue(value: DateValue) {
	if (value === null || value === undefined || value === "") return null;
	// EmDash treats offsetless SQLite datetimes as UTC on every host.
	const utcValue =
		typeof value === "string" &&
		/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)
			? `${value.replace(" ", "T")}Z`
			: value;
	const date = utcValue instanceof Date ? utcValue : new Date(utcValue);
	if (Number.isNaN(date.getTime())) return null;

	return [
		String(date.getUTCFullYear()).padStart(4, "0"),
		String(date.getUTCMonth() + 1).padStart(2, "0"),
		String(date.getUTCDate()).padStart(2, "0"),
	];
}

export function derivePagePath(path?: string | null, slug?: string | null) {
	const normalizedPath = normalizeContentPath(path);
	const pageSlug = slugFromPath(slug) || slugFromPath(normalizedPath);
	if (!pageSlug) return normalizedPath;
	if (!normalizedPath && pageSlug === "home") return "";

	return [...prefixFromPath(normalizedPath), pageSlug].join("/");
}

export function postPath(slug?: string | null, publishedAt?: DateValue) {
	const dateParts = datePartsFromValue(publishedAt);
	return slug && dateParts
		? [...dateParts, encodeURIComponent(slug)].join("/")
		: "";
}

export function projectPath(slug?: string | null) {
	const projectSlug = slugFromPath(slug);
	return projectSlug ? `project/${projectSlug}` : "project";
}
