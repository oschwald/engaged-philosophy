import { describe, expect, test } from "vitest";

import createCacheProvider from "../../src/lib/cloudflare-cache-provider";
import { cachePurgeCalls } from "../support/cloudflare-workers";

describe("Cloudflare cache provider", () => {
	test("uses the adapter cache headers", () => {
		const provider = createCacheProvider(undefined);
		const headers = provider.setHeaders?.(
			{ maxAge: 300, swr: 60, tags: ["pages"] },
			new Request("https://www.engagedphilosophy.com/about/"),
		);

		expect(headers?.get("cloudflare-cdn-cache-control")).toBe(
			"public, max-age=300, stale-while-revalidate=60",
		);
		expect(headers?.get("cache-tag")).toBe("pages,astro-path:/about/");
	});

	test("forwards tag invalidation to the adapter provider", async () => {
		cachePurgeCalls.length = 0;
		const provider = createCacheProvider(undefined);
		await provider.invalidate({ tags: "pages" });

		expect(cachePurgeCalls).toEqual([{ tags: ["pages"] }]);
	});
});
