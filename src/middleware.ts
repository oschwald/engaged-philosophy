import { defineMiddleware } from "astro:middleware";

import { cacheTagsForMutation } from "./lib/cache-invalidation";

export const onRequest = defineMiddleware(async (context, next) => {
	const tags = cacheTagsForMutation(
		context.request.method,
		context.url.pathname,
	);
	const response = await next();

	if (response.ok && tags.length > 0 && context.cache.enabled) {
		await context.cache.invalidate({ tags });
	}

	return response;
});
