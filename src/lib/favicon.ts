import { rewriteInternalMediaFileUrl } from "./media";

type SiteFaviconSettings = {
	favicon?: {
		url?: string | null;
	} | null;
};

export function getConfiguredFaviconHref(
	settings?: SiteFaviconSettings | null,
	mediaUrlPrefix?: string,
) {
	const url = settings?.favicon?.url;
	return url ? rewriteInternalMediaFileUrl(url, mediaUrlPrefix) : "";
}

export function createFaviconResponse(
	settings?: SiteFaviconSettings | null,
	mediaUrlPrefix?: string,
) {
	const faviconHref = getConfiguredFaviconHref(settings, mediaUrlPrefix);
	return new Response(null, {
		status: faviconHref ? 302 : 404,
		headers: {
			"Cache-Control": "no-cache",
			...(faviconHref ? { Location: faviconHref } : {}),
		},
	});
}
