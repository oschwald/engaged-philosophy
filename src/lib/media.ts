import { env as cloudflareEnv } from "cloudflare:workers";

import { PUBLIC_MEDIA_URL } from "./site-config";

export { PUBLIC_MEDIA_URL };

const EMDASH_MEDIA_FILE_PREFIX = "/_emdash/api/media/file/";

function normalizeMediaHost(value: string) {
	return value.replace(/\/+$/, "");
}

export function getMediaUrlPrefix(
	runtimeEnv?: { SITE_PREVIEW?: string } | null,
) {
	const workerEnv = cloudflareEnv as { SITE_PREVIEW?: string };
	return (runtimeEnv ?? workerEnv).SITE_PREVIEW === "true"
		? EMDASH_MEDIA_FILE_PREFIX.replace(/\/$/, "")
		: PUBLIC_MEDIA_URL;
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
