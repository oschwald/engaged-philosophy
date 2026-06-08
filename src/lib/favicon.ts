import { getMediaUrlPrefix, rewriteInternalMediaFileUrl } from "./media";
import { safeUrlForMediaSrc } from "./url-safety";

export type SiteFaviconSettings = {
	favicon?: {
		url?: string | null;
	} | null;
};

type CreateFaviconResponseOptions = {
	mediaUrlPrefix?: string;
	requestUrl?: string | URL;
};

export const FAVICON_CACHE_CONTROL =
	"public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
export const FAVICON_NOT_FOUND_CACHE_CONTROL = "public, max-age=0, s-maxage=60";
const COMPATIBILITY_FAVICON_PATHS = new Set([
	"/favicon.ico",
	"/favicon.svg",
	"/favicon-simple.svg",
]);

function isRootRelativeCompatibilityFaviconPath(value: string) {
	if (!value.startsWith("/") || value.startsWith("//")) return false;

	try {
		const url = new URL(value, "https://example.test");
		return COMPATIBILITY_FAVICON_PATHS.has(url.pathname);
	} catch {
		return false;
	}
}

function isSameRequestTarget(value: string, requestUrl?: string | URL) {
	if (!requestUrl) return false;

	try {
		const request = new URL(requestUrl);
		const target = new URL(value, request);
		return (
			target.origin === request.origin && target.pathname === request.pathname
		);
	} catch {
		return false;
	}
}

function isAllowedMediaUrl(value: string, mediaUrlPrefix: string) {
	try {
		const url = new URL(value);
		const mediaUrl = new URL(mediaUrlPrefix);
		return url.origin === mediaUrl.origin;
	} catch {
		return false;
	}
}

export function getConfiguredFaviconHref(
	settings?: SiteFaviconSettings | null,
	mediaUrlPrefix?: string,
) {
	const url = settings?.favicon?.url;
	if (!url) return "";

	const resolvedMediaUrlPrefix = mediaUrlPrefix ?? getMediaUrlPrefix();
	const faviconHref = safeUrlForMediaSrc(
		rewriteInternalMediaFileUrl(url, resolvedMediaUrlPrefix),
	);
	if (!faviconHref) return "";
	if (isRootRelativeCompatibilityFaviconPath(faviconHref)) return "";

	return isAllowedMediaUrl(faviconHref, resolvedMediaUrlPrefix)
		? faviconHref
		: "";
}

export function createFaviconResponse(
	settings?: SiteFaviconSettings | null,
	options: CreateFaviconResponseOptions = {},
) {
	const faviconHref = getConfiguredFaviconHref(
		settings,
		options.mediaUrlPrefix,
	);
	const location = isSameRequestTarget(faviconHref, options.requestUrl)
		? ""
		: faviconHref;

	return new Response(null, {
		status: location ? 302 : 404,
		headers: {
			"Cache-Control": location
				? FAVICON_CACHE_CONTROL
				: FAVICON_NOT_FOUND_CACHE_CONTROL,
			...(location ? { Location: location } : {}),
		},
	});
}
