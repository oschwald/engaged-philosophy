const DATE_PATH_RE = /^(\d{4})\/(\d{2})\/(\d{2})(?:\/|$)/;

type DateValue = Date | string | number | null | undefined;

// Canonical URL rules mirror the migrated WordPress shape:
// pages keep their existing parent path and replace only the leaf slug,
// posts live under YYYY/MM/DD, and projects live under /project/{slug}/.
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

function datePartsFromPath(path?: string | null) {
	const match = DATE_PATH_RE.exec(normalizeContentPath(path));
	return match ? [match[1], match[2], match[3]] : null;
}

function datePartsFromValue(value: DateValue) {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
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

export function derivePostPath(
	path?: string | null,
	slug?: string | null,
	publishedOn?: DateValue,
	publishedAt?: DateValue,
	createdAt?: DateValue,
) {
	const normalizedPath = normalizeContentPath(path);
	const postSlug = slugFromPath(slug) || slugFromPath(normalizedPath);
	if (!postSlug) return normalizedPath;

	const dateParts =
		datePartsFromPath(normalizedPath) ??
		datePartsFromValue(publishedOn) ??
		datePartsFromValue(publishedAt) ??
		datePartsFromValue(createdAt);

	return dateParts ? [...dateParts, postSlug].join("/") : postSlug;
}

export function deriveProjectPath(path?: string | null, slug?: string | null) {
	const normalizedPath = normalizeContentPath(path);
	const projectSlug = slugFromPath(slug) || slugFromPath(normalizedPath);
	return projectSlug ? `project/${projectSlug}` : normalizedPath;
}
