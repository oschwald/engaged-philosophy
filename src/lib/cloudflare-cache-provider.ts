import cloudflareCacheProvider from "@astrojs/cloudflare/cache/provider";
import type { CacheProviderFactory } from "astro";
import { collectInvalidationTags } from "astro/cache/provider-utils";

const factory: CacheProviderFactory = (config) => {
	const provider = cloudflareCacheProvider(config);

	return {
		...provider,
		async invalidate(options) {
			const { cache } = await import("cloudflare:workers");
			// Wrangler's local Workers Cache lacks purge(); keep mutations usable in dev.
			if (typeof cache.purge !== "function") return;

			const tags = collectInvalidationTags(options);
			if (tags.length === 0) return;

			const result = await cache.purge({ tags });
			if (!result.success) {
				const details = result.errors
					.map(({ code, message }) => `[${code}] ${message}`)
					.join("; ");
				throw new Error(
					details
						? `Cloudflare cache purge failed: ${details}`
						: "Cloudflare cache purge failed",
				);
			}
		},
	};
};

export default factory;
