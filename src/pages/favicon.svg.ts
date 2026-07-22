import type { APIRoute } from "astro";

import { SITE_SETTINGS_CACHE_TAG } from "../lib/cache-tags";
import { createFaviconResponse } from "../lib/favicon";
import { getRuntimeSiteSettings } from "../lib/content";
import {
	ANONYMOUS_PAGE_CACHE_MAX_AGE_SECONDS,
	ANONYMOUS_PAGE_CACHE_SWR_SECONDS,
} from "../lib/site-config";

export const GET: APIRoute = async ({ cache, request }) => {
	cache.set({
		maxAge: ANONYMOUS_PAGE_CACHE_MAX_AGE_SECONDS,
		swr: ANONYMOUS_PAGE_CACHE_SWR_SECONDS,
		tags: [SITE_SETTINGS_CACHE_TAG],
	});
	return createFaviconResponse(await getRuntimeSiteSettings(), {
		requestUrl: request.url,
	});
};
