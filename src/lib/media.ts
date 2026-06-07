import { env as cloudflareEnv } from "cloudflare:workers";

import { PUBLIC_MEDIA_URL, WORDPRESS_SITE_URL } from "./site-config";
import { safeUrlForMediaSrc } from "./url-safety";

export { PUBLIC_MEDIA_URL, WORDPRESS_SITE_URL };

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

	const encodedKey =
		normalized.replace(EMDASH_MEDIA_FILE_PREFIX, "").split(/[?#]/)[0] ?? "";
	try {
		return decodeURIComponent(encodedKey);
	} catch {
		return encodedKey;
	}
}

function getStorageKeyFromMeta(meta?: Record<string, unknown> | null) {
	return typeof meta?.storageKey === "string" ? meta.storageKey : "";
}

function resolvePublicMediaUrl(
	key: string,
	getPublicMediaUrl?: ((key: string) => string) | null,
) {
	if (!key) return "";
	let resolvedUrl = "";

	if (getPublicMediaUrl) {
		try {
			resolvedUrl = getPublicMediaUrl(key) || "";
		} catch (e) {
			console.error("Failed to resolve public media URL:", e);
		}
	}

	if (resolvedUrl && !resolvedUrl.startsWith(EMDASH_MEDIA_FILE_PREFIX)) {
		const safeResolvedUrl = safeUrlForMediaSrc(resolvedUrl);
		if (safeResolvedUrl) return safeResolvedUrl;
	}

	return getPublicMediaStorageUrl(key);
}

function isPublicMediaRef(value?: string | null) {
	return Boolean(value && !value.includes("/") && !value.startsWith("http"));
}

export function getAssetSrc(
	asset?: {
		_ref?: string;
		url?: string;
		meta?: Record<string, unknown>;
	} | null,
	fallbackUrl?: string | null,
	getPublicMediaUrl?: ((key: string) => string) | null,
) {
	const url = asset?.url ?? fallbackUrl ?? "";
	const storageKey =
		getStorageKeyFromMeta(asset?.meta) ||
		getInternalMediaKey(asset?.url) ||
		getInternalMediaKey(fallbackUrl);
	const resolvedStorageUrl = resolvePublicMediaUrl(
		storageKey,
		getPublicMediaUrl,
	);
	if (resolvedStorageUrl) return resolvedStorageUrl;

	const mediaRefUrl = asset?._ref
		? resolvePublicMediaUrl(
				isPublicMediaRef(asset._ref) ? asset._ref : "",
				getPublicMediaUrl,
			)
		: "";
	if (mediaRefUrl) return mediaRefUrl;

	if (isWordPressUploadUrl(url)) {
		return rewriteWordPressUploadUrl(url, getMediaUrlPrefix());
	}

	return safeUrlForMediaSrc(url);
}

export function getMediaUrlPrefix(
	runtimeEnv?: { PUBLIC_MEDIA_URL?: string } | null,
) {
	const workerEnv = cloudflareEnv as { PUBLIC_MEDIA_URL?: string };
	return (
		runtimeEnv?.PUBLIC_MEDIA_URL ||
		workerEnv.PUBLIC_MEDIA_URL ||
		PUBLIC_MEDIA_URL
	).replace(/\/+$/, "");
}

export function getPublicMediaStorageUrl(
	key?: string | null,
	mediaUrlPrefix = getMediaUrlPrefix(),
) {
	const normalizedKey = (key ?? "").trim().replace(/^\/+/, "");
	if (!normalizedKey) return "";
	const encodedKey = normalizedKey.split("/").map(encodeURIComponent).join("/");
	return `${normalizeMediaHost(mediaUrlPrefix)}/${encodedKey}`;
}

export function rewriteInternalMediaFileUrl(
	value?: string | null,
	mediaUrlPrefix = getMediaUrlPrefix(),
) {
	const storageKey = getInternalMediaKey(value);
	return storageKey
		? getPublicMediaStorageUrl(storageKey, mediaUrlPrefix)
		: (value ?? "");
}

export function rewriteWordPressUploadUrl(
	value?: string | null,
	mediaUrlPrefix = WORDPRESS_SITE_URL,
) {
	const normalized = (value ?? "").trim();
	if (!normalized) return "";
	const internalMediaUrl = rewriteInternalMediaFileUrl(
		normalized,
		mediaUrlPrefix,
	);
	if (internalMediaUrl !== normalized) return internalMediaUrl;

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
