import { afterEach, beforeEach, describe, expect, test } from "vitest";

import createCacheProvider from "../../src/lib/cloudflare-cache-provider";
import {
	cachePurgeCalls,
	resetCachePurgeMock,
	setCachePurgeResult,
	setCachePurgeSupported,
} from "../support/cloudflare-workers";

describe("Cloudflare cache headers and invalidation", () => {
	beforeEach(resetCachePurgeMock);
	afterEach(resetCachePurgeMock);

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

	test("purges tag and path invalidations", async () => {
		const provider = createCacheProvider(undefined);
		await provider.invalidate({ tags: "pages" });
		await provider.invalidate({ path: "/about/" });

		expect(cachePurgeCalls).toEqual([
			{ tags: ["pages"] },
			{ tags: ["astro-path:/about/"] },
		]);
	});

	test("skips invalidation when local purge support is unavailable", async () => {
		setCachePurgeSupported(false);
		const provider = createCacheProvider(undefined);

		await expect(
			provider.invalidate({ tags: "pages" }),
		).resolves.toBeUndefined();
		expect(cachePurgeCalls).toEqual([]);
	});

	test("reports unsuccessful purge results", async () => {
		setCachePurgeResult({
			success: false,
			errors: [{ code: 429, message: "rate limit exceeded" }],
		});
		const provider = createCacheProvider(undefined);

		await expect(provider.invalidate({ tags: "pages" })).rejects.toThrow(
			"Cloudflare cache purge failed: [429] rate limit exceeded",
		);
	});
});
