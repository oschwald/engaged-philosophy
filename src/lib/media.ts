import { env as cloudflareEnv } from "cloudflare:workers";

export const WORDPRESS_SITE_URL = "https://www.engagedphilosophy.com";

const WORDPRESS_SITE_HOST_RE = /^(?:www\.)?engagedphilosophy\.com$/i;
const EMDASH_MEDIA_FILE_PREFIX = "/_emdash/api/media/file/";

function normalizeMediaHost(value: string) {
	return value.replace(/\/+$/, "");
}

function sanitizeUploadPath(pathname: string) {
	return pathname
		.split("/")
		.map((segment) => segment.replace(/\.\.+/g, "."))
		.join("/");
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

function getInternalMediaKey(value?: string | null) {
	const normalized = value ?? "";
	if (!normalized.startsWith(EMDASH_MEDIA_FILE_PREFIX)) return "";

	return decodeURIComponent(
		normalized.replace(EMDASH_MEDIA_FILE_PREFIX, "").split(/[?#]/)[0] ?? "",
	);
}

function resolvePublicMediaUrl(
	key: string,
	getPublicMediaUrl?: ((key: string) => string) | null,
) {
	if (!key || !getPublicMediaUrl) return "";

	try {
		return getPublicMediaUrl(key) || "";
	} catch (e) {
		console.error("Failed to resolve public media URL:", e);
		return "";
	}
}

function isPublicMediaRef(value?: string | null) {
	return Boolean(value && !value.includes("/") && !value.startsWith("http"));
}

export function getAssetSrc(
	asset?: { _ref?: string; url?: string } | null,
	fallbackUrl?: string | null,
	getPublicMediaUrl?: ((key: string) => string) | null,
) {
	const url = asset?.url ?? fallbackUrl ?? "";
	const internalMediaUrl = resolvePublicMediaUrl(
		getInternalMediaKey(url),
		getPublicMediaUrl,
	);
	if (internalMediaUrl) return internalMediaUrl;

	if (isWordPressUploadUrl(url)) {
		return rewriteWordPressUploadUrl(url, getMediaUrlPrefix());
	}

	const mediaRefUrl = asset?._ref
		? resolvePublicMediaUrl(
				getInternalMediaKey(asset.url) ||
					(isPublicMediaRef(asset._ref) ? asset._ref : ""),
				getPublicMediaUrl,
			)
		: "";
	if (mediaRefUrl) return mediaRefUrl;

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
			/^(?:www\.|media\.)?engagedphilosophy\.com$/i.test(url.hostname) &&
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
