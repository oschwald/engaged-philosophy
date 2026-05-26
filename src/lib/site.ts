import { env as cloudflareEnv } from "cloudflare:workers";

export const PROJECT_TAXONOMIES = [
	"topic",
	"schools",
	"professors",
	"courses",
	"semesters",
] as const;

export type ProjectTaxonomy = (typeof PROJECT_TAXONOMIES)[number];

interface EmDashEditRef {
	collection: string;
	id: string;
	status: string;
	hasDraft: boolean;
	field?: string;
}

export const WORDPRESS_SITE_URL = "https://www.engagedphilosophy.com";

function normalizeMediaHost(value: string) {
	return value.replace(/\/+$/, "");
}

function sanitizeUploadPath(pathname: string) {
	return pathname
		.split("/")
		.map((segment) => segment.replace(/\.\.+/g, "."))
		.join("/");
}

export function isProjectTaxonomy(value: string): value is ProjectTaxonomy {
	return PROJECT_TAXONOMIES.includes(value as ProjectTaxonomy);
}

export function joinPath(parts: string[]) {
	return parts.filter(Boolean).join("/");
}

export function sortByPublishedOn<
	T extends { data: { published_on?: string; title?: string } },
>(items: T[]) {
	return [...items].sort((a, b) => {
		const orderA =
			"menu_order" in a.data && typeof a.data.menu_order === "number"
				? a.data.menu_order
				: 0;
		const orderB =
			"menu_order" in b.data && typeof b.data.menu_order === "number"
				? b.data.menu_order
				: 0;
		if (orderA !== orderB) return orderA - orderB;

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

export function getEntryDatabaseId<T extends { id?: string }>(item: {
	id: string;
	data: T;
}) {
	return item.data.id || item.id;
}

export function getEmDashEditAttrs(
	collection: string,
	identifier: string,
	status: string,
	field?: string,
) {
	const ref: EmDashEditRef = {
		collection,
		id: identifier,
		status,
		hasDraft: false,
		...(field ? { field } : {}),
	};

	return {
		"data-emdash-ref": JSON.stringify(ref),
	};
}

export function decodeHtmlEntities(value?: string | null) {
	const namedEntities: Record<string, string> = {
		amp: "&",
		apos: "'",
		quot: '"',
		nbsp: " ",
		hellip: "…",
		ndash: "–",
		mdash: "—",
		lsquo: "‘",
		rsquo: "’",
		ldquo: "“",
		rdquo: "”",
	};

	return (value ?? "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, token) => {
		const lowerToken = token.toLowerCase();
		if (lowerToken.startsWith("#x")) {
			const codePoint = Number.parseInt(lowerToken.slice(2), 16);
			return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
		}
		if (lowerToken.startsWith("#")) {
			const codePoint = Number.parseInt(lowerToken.slice(1), 10);
			return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
		}
		return namedEntities[lowerToken] ?? entity;
	});
}

export function stripHtml(value?: string | null) {
	return decodeHtmlEntities(value)
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/<[^>]+>/g, " ")
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

export function getMediaUrlPrefix(
	runtimeEnv?: { PUBLIC_MEDIA_URL?: string } | null,
) {
	const workerEnv = cloudflareEnv as { PUBLIC_MEDIA_URL?: string };
	return (
		runtimeEnv?.PUBLIC_MEDIA_URL ||
		workerEnv.PUBLIC_MEDIA_URL ||
		WORDPRESS_SITE_URL
	).replace(/\/+$/, "");
}

export function rewriteWordPressUploadUrl(
	value?: string | null,
	mediaUrlPrefix = WORDPRESS_SITE_URL,
) {
	const normalized = (value ?? "").trim();
	if (!normalized) return "";
	const normalizedPrefix = normalizeMediaHost(mediaUrlPrefix);
	const shouldSanitize = normalizedPrefix !== WORDPRESS_SITE_URL;

	if (normalized.startsWith("/wp-content/uploads/")) {
		const pathname = shouldSanitize
			? sanitizeUploadPath(normalized)
			: normalized;
		return `${normalizedPrefix}${pathname}`;
	}
	try {
		const url = new URL(normalized);
		if (
			/^(?:www\.)?engagedphilosophy\.com$/i.test(url.hostname) &&
			url.pathname.startsWith("/wp-content/uploads/")
		) {
			const pathname = shouldSanitize
				? sanitizeUploadPath(url.pathname)
				: url.pathname;
			return `${normalizedPrefix}${pathname}${url.search}${url.hash}`;
		}
	} catch {
		return normalized;
	}

	return normalized;
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
