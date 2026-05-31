export const WORDPRESS_MEDIA_ID_PREFIX = "wp-media-";
export const EMDASH_MEDIA_FILE_PREFIX = "/_emdash/api/media/file/";
export const DEFAULT_WORDPRESS_SITE_URL = "https://www.engagedphilosophy.com";

export const INTERNAL_UPLOAD_HOSTS = new Set([
	"engagedphilosophy.com",
	"www.engagedphilosophy.com",
	"media.engagedphilosophy.com",
]);

const MIME_TYPES_BY_EXTENSION = new Map([
	[".jpg", "image/jpeg"],
	[".jpeg", "image/jpeg"],
	[".png", "image/png"],
	[".gif", "image/gif"],
	[".webp", "image/webp"],
	[".avif", "image/avif"],
	[".ico", "image/x-icon"],
	[".tif", "image/tiff"],
	[".tiff", "image/tiff"],
	[".mp4", "video/mp4"],
	[".m4v", "video/mp4"],
	[".mov", "video/quicktime"],
	[".webm", "video/webm"],
	[".ogv", "video/ogg"],
	[".mp3", "audio/mpeg"],
	[".wav", "audio/wav"],
	[".ogg", "audio/ogg"],
	[".pdf", "application/pdf"],
	[".doc", "application/msword"],
	[
		".docx",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	],
	[".html", "text/html"],
]);

export function wordpressMediaId(id) {
	return `${WORDPRESS_MEDIA_ID_PREFIX}${id}`;
}

export function sanitizeObjectKey(key) {
	return key
		.split("/")
		.map((segment) => segment.replace(/\.\.+/g, "."))
		.join("/");
}

export function uploadStorageKeyFromUrl(
	value,
	siteUrl = DEFAULT_WORDPRESS_SITE_URL,
) {
	const trimmed = (value || "").trim();
	if (!trimmed) return "";

	if (trimmed.startsWith(EMDASH_MEDIA_FILE_PREFIX)) {
		const key = trimmed.slice(EMDASH_MEDIA_FILE_PREFIX.length).split(/[?#]/)[0];
		return sanitizeObjectKey(key);
	}

	if (trimmed.startsWith("/wp-content/uploads/")) {
		return sanitizeObjectKey(trimmed.replace(/^\/+/, "").split(/[?#]/)[0]);
	}

	try {
		const parsed = new URL(trimmed, siteUrl);
		if (
			!INTERNAL_UPLOAD_HOSTS.has(parsed.hostname.toLowerCase()) ||
			!parsed.pathname.startsWith("/wp-content/uploads/")
		) {
			return "";
		}
		return sanitizeObjectKey(parsed.pathname.replace(/^\/+/, ""));
	} catch {
		return "";
	}
}

export function internalMediaFileUrlForUpload(
	value,
	siteUrl = DEFAULT_WORDPRESS_SITE_URL,
) {
	const key = uploadStorageKeyFromUrl(value, siteUrl);
	return key ? `${EMDASH_MEDIA_FILE_PREFIX}${key}` : "";
}

export function filenameFromMediaUrl(value) {
	const trimmed = (value || "").trim();
	if (!trimmed) return "";

	try {
		const parsed = new URL(trimmed, DEFAULT_WORDPRESS_SITE_URL);
		return decodeURIComponent(parsed.pathname.split("/").pop() || "");
	} catch {
		return trimmed.split(/[?#]/)[0].split("/").pop() || "";
	}
}

export function guessMimeTypeFromPath(value) {
	const pathname = (() => {
		try {
			return new URL(value, DEFAULT_WORDPRESS_SITE_URL).pathname;
		} catch {
			return value || "";
		}
	})().toLowerCase();
	const extensionMatch = pathname.match(/\.[a-z0-9]+$/i);
	return extensionMatch
		? (MIME_TYPES_BY_EXTENSION.get(extensionMatch[0]) ??
				"application/octet-stream")
		: "application/octet-stream";
}

export function mediaValueForWordPressAttachment(id, attachment) {
	const storageKey = uploadStorageKeyFromUrl(attachment?.url || "");
	if (!id || !attachment?.url || !storageKey) return undefined;

	return {
		provider: "local",
		id: wordpressMediaId(id),
		filename: attachment.filename || filenameFromMediaUrl(attachment.url),
		mimeType:
			attachment.mimeType ||
			guessMimeTypeFromPath(attachment.filename || attachment.url),
		alt: attachment.alt || attachment.title || "",
		...(typeof attachment.width === "number"
			? { width: attachment.width }
			: {}),
		...(typeof attachment.height === "number"
			? { height: attachment.height }
			: {}),
		meta: { storageKey },
	};
}
