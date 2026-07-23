import type { APIRoute } from "astro";

import { SITE_SETTINGS_CACHE_TAG } from "../lib/cache-tags";
import { getRuntimeSiteSettings } from "../lib/content";
import { rewriteInternalMediaFileUrl } from "../lib/media";
import {
	PUBLIC_EDGE_CACHE_MAX_AGE_SECONDS,
	PUBLIC_EDGE_CACHE_SWR_SECONDS,
	SITE_TAGLINE_FALLBACK,
	SITE_TITLE_FALLBACK,
} from "../lib/site-config";

export const GET: APIRoute = async ({ cache }) => {
	cache.set({
		maxAge: PUBLIC_EDGE_CACHE_MAX_AGE_SECONDS,
		swr: PUBLIC_EDGE_CACHE_SWR_SECONDS,
		tags: [SITE_SETTINGS_CACHE_TAG],
	});
	const settings = await getRuntimeSiteSettings();
	const siteTitle = settings?.title || SITE_TITLE_FALLBACK;
	const favicon = settings?.favicon;
	const icons = favicon?.url
		? [
				{
					src: rewriteInternalMediaFileUrl(favicon.url),
					sizes:
						favicon.width && favicon.height
							? `${favicon.width}x${favicon.height}`
							: "any",
					...(favicon.contentType ? { type: favicon.contentType } : {}),
				},
			]
		: [];

	return new Response(
		JSON.stringify(
			{
				name: siteTitle,
				short_name:
					siteTitle === SITE_TITLE_FALLBACK ? "EngagedPhil" : siteTitle,
				description: settings?.tagline || SITE_TAGLINE_FALLBACK,
				icons,
				theme_color: "#fd7e14",
				background_color: "#ffffff",
				display: "standalone",
			},
			null,
			"\t",
		),
		{
			headers: {
				"Content-Type": "application/manifest+json; charset=utf-8",
				"Cache-Control": "public, max-age=0, must-revalidate",
			},
		},
	);
};
