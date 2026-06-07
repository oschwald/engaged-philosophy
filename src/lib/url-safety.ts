const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]/;
const SAFE_IFRAME_HOSTS = new Set([
	"animoto.com",
	"player.vimeo.com",
	"vimeo.com",
	"www.animoto.com",
	"www.youtube.com",
	"www.youtube-nocookie.com",
	"youtube.com",
	"youtube-nocookie.com",
]);

function normalizeUrlValue(value?: string | null) {
	const normalized = (value ?? "").trim();
	if (!normalized || CONTROL_CHAR_RE.test(normalized)) return "";
	return normalized;
}

function safeRelativeUrl(value: string) {
	if (value.startsWith("//")) return "";
	if (value.startsWith("/") || value.startsWith("#") || value.startsWith("?")) {
		return value;
	}
	return "";
}

function safeAbsoluteHttpUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:"
			? url.href
			: "";
	} catch {
		return "";
	}
}

function safeAbsoluteHttpsUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === "https:" ? url.href : "";
	} catch {
		return "";
	}
}

export function safeUrlForHref(value?: string | null) {
	const normalized = normalizeUrlValue(value);
	if (!normalized) return "";

	return safeRelativeUrl(normalized) || safeAbsoluteHttpUrl(normalized);
}

export function safeUrlForMediaSrc(value?: string | null) {
	const normalized = normalizeUrlValue(value);
	if (!normalized) return "";
	if (normalized.startsWith("//")) return "";
	if (normalized.startsWith("/")) return normalized;

	return safeAbsoluteHttpsUrl(normalized);
}

export function safeUrlForIframeSrc(value?: string | null) {
	const normalized = normalizeUrlValue(value);
	if (!normalized) return "";

	try {
		const url = new URL(normalized);
		if (url.protocol !== "https:") return "";
		return SAFE_IFRAME_HOSTS.has(url.hostname.toLowerCase()) ? url.href : "";
	} catch {
		return "";
	}
}
