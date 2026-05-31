import { getRequestContext } from "emdash";
import { env as cloudflareEnv } from "cloudflare:workers";
import type { PortableTextBlock } from "emdash/ui";

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

interface EmDashFieldAnnotation {
	"data-emdash-ref": string;
}

interface EmDashEditProxy {
	readonly [field: string]: Partial<EmDashFieldAnnotation>;
}

type RichTextFieldValue = PortableTextBlock[] | null | undefined;

interface RichTextEntryData {
	content?: RichTextFieldValue;
	excerpt?: RichTextFieldValue;
}

export const WORDPRESS_SITE_URL = "https://www.engagedphilosophy.com";
const WORDPRESS_SITE_HOST_RE = /^(?:www\.)?engagedphilosophy\.com$/i;

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

function hasEmDashEditProxy<T extends { id?: string }>(
	entry: object,
): entry is {
	id: string;
	data: T;
	edit: EmDashEditProxy & Partial<EmDashFieldAnnotation>;
} {
	return (
		"edit" in entry && typeof entry.edit === "object" && entry.edit !== null
	);
}

export function isEmDashEditMode() {
	return getRequestContext()?.editMode ?? false;
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

export function getEmDashEditEntryAttrs<T extends { id?: string }>(
	collection: string,
	entry: { id: string; data: T; status?: string },
	field?: string,
) {
	if (hasEmDashEditProxy<T>(entry)) {
		return field ? (entry.edit[field] ?? {}) : entry.edit;
	}

	return getEmDashEditAttrs(
		collection,
		getEntryDatabaseId(entry),
		entry.status ?? "published",
		field,
	);
}

function getRichTextValue(value: RichTextFieldValue) {
	return Array.isArray(value) ? value : undefined;
}

export function getEntryContent(data?: RichTextEntryData | null) {
	return getRichTextValue(data?.content);
}

export function getEntryExcerpt(data?: RichTextEntryData | null) {
	return getRichTextValue(data?.excerpt);
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

function stripWordPressShortcodes(value: string) {
	return value.replace(/\[(?:\/)?[a-z][\w-]*(?:[^\]]*)\]/gi, " ");
}

function portableTextToPlainText(value: PortableTextBlock[]) {
	return value
		.map((block) => {
			if (block._type === "block" && Array.isArray(block.children)) {
				const children = block.children as Array<{ text?: unknown }>;
				return children
					.map((child: { text?: unknown }) =>
						typeof child.text === "string" ? child.text : "",
					)
					.join("");
			}
			if (block._type === "image") {
				return typeof block.alt === "string" ? block.alt : "";
			}
			if ("images" in block && Array.isArray(block.images)) {
				const images = block.images as Array<{
					alt?: unknown;
					caption?: unknown;
				}>;
				return images
					.map((image) =>
						typeof image.alt === "string"
							? image.alt
							: typeof image.caption === "string"
								? image.caption
								: "",
					)
					.join(" ");
			}
			return "";
		})
		.join(" ");
}

export function isPortableTextValue(
	value?: string | PortableTextBlock[] | null,
): value is PortableTextBlock[] {
	return Array.isArray(value);
}

export function stripHtml(value?: string | PortableTextBlock[] | null) {
	if (isPortableTextValue(value)) {
		return stripWordPressShortcodes(portableTextToPlainText(value))
			.replace(/\s+/g, " ")
			.trim();
	}

	return stripWordPressShortcodes(decodeHtmlEntities(value))
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function getExcerptText(
	excerpt?: string | PortableTextBlock[] | null,
	content?: string | PortableTextBlock[] | null,
	wordLimit = 55,
) {
	const preferred = stripHtml(excerpt);
	if (preferred) return preferred;

	const contentText = stripHtml(content);
	if (!contentText) return "";

	const words = contentText.split(/\s+/);
	return words.slice(0, wordLimit).join(" ");
}

export function isWordPressUploadUrl(value?: string | null) {
	const normalized = (value ?? "").trim();
	return (
		normalized.startsWith("/wp-content/uploads/") ||
		/^https?:\/\/(?:www\.|media\.)?engagedphilosophy\.com\/wp-content\/uploads\//i.test(
			normalized,
		)
	);
}

export function getAssetSrc(
	asset?: { _ref?: string; url?: string } | null,
	fallbackUrl?: string | null,
	getPublicMediaUrl?: ((key: string) => string) | null,
) {
	const url = asset?.url ?? fallbackUrl ?? "";
	const internalMediaKey = url.startsWith("/_emdash/api/media/file/")
		? decodeURIComponent(
				url.replace(/^\/_emdash\/api\/media\/file\//, "").split(/[?#]/)[0] ??
					"",
			)
		: "";
	if (internalMediaKey && getPublicMediaUrl) {
		try {
			const resolved = getPublicMediaUrl(internalMediaKey);
			if (resolved) return resolved;
		} catch (e) {
			console.error("Failed to resolve public media URL:", e);
		}
	}

	if (isWordPressUploadUrl(url)) {
		return rewriteWordPressUploadUrl(url, getMediaUrlPrefix());
	}

	if (
		asset?._ref &&
		getPublicMediaUrl &&
		!asset._ref.includes("/") &&
		!asset._ref.startsWith("http")
	) {
		try {
			const key =
				asset.url && asset.url.startsWith("/_emdash/api/media/file/")
					? asset.url.replace(/^\/_emdash\/api\/media\/file\//, "")
					: asset._ref;
			const resolved = getPublicMediaUrl(key);
			if (resolved) return resolved;
		} catch (e) {
			console.error("Failed to resolve public media URL:", e);
		}
	}

	return url;
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

export function rewriteWordPressSiteUrl(value?: string | null) {
	const normalized = (value ?? "").trim();
	if (!normalized) return "";
	if (normalized.startsWith("/")) return normalized;

	try {
		const url = new URL(normalized);
		if (WORDPRESS_SITE_HOST_RE.test(url.hostname)) {
			return `${url.pathname}${url.search}${url.hash}` || "/";
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
