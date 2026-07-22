import cloudflareCacheProvider from "@astrojs/cloudflare/cache/provider";
import type { CacheProviderFactory } from "astro";
import { collectInvalidationTags } from "astro/cache/provider-utils";

const factory: CacheProviderFactory = (config) => {
	const provider = cloudflareCacheProvider(config);

	return {
		...provider,
		async invalidate(options) {
			const { cache } = await import("cloudflare:workers");
			// Workers Cache is not emulated locally yet; keep mutations usable in dev.
			if (typeof cache.purge !== "function") return;

			const tags = collectInvalidationTags(options);
			if (tags.length === 0) return;
			await cache.purge({ tags });
		},
	};
};

export default factory;
