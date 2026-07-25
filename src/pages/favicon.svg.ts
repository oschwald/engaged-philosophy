import type { APIRoute } from "astro";
import { getSiteSettings } from "emdash";

import { SITE_SETTINGS_CACHE_TAG } from "../lib/cache-tags";
import { createFaviconResponse } from "../lib/favicon";
import {
	PUBLIC_EDGE_CACHE_MAX_AGE_SECONDS,
	PUBLIC_EDGE_CACHE_SWR_SECONDS,
} from "../lib/site-config";

export const GET: APIRoute = async ({ cache, request }) => {
	cache.set({
		maxAge: PUBLIC_EDGE_CACHE_MAX_AGE_SECONDS,
		swr: PUBLIC_EDGE_CACHE_SWR_SECONDS,
		tags: [SITE_SETTINGS_CACHE_TAG],
	});
	return createFaviconResponse(await getSiteSettings(), {
		requestUrl: request.url,
	});
};
