import { env as cloudflareEnv } from "cloudflare:workers";

import { PUBLIC_MEDIA_URL } from "./site-config";

export { PUBLIC_MEDIA_URL };

const EMDASH_MEDIA_FILE_PREFIX = "/_emdash/api/media/file/";

function normalizeMediaHost(value: string) {
	return value.replace(/\/+$/, "");
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
