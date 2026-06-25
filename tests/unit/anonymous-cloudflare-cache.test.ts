import { describe, expect, test } from "vitest";

import {
	default as createCacheProvider,
	hasStatefulCookie,
	isAnonymousPageCacheCandidate,
	normalizePageCacheInvalidationKeys,
	normalizePageCacheKey,
} from "../../src/lib/anonymous-cloudflare-cache";

function request(path: string, init: RequestInit = {}) {
	return new Request(
		`https://engaged-philosophy.ramona75.workers.dev${path}`,
		init,
	);
}

class MemoryCache implements Pick<Cache, "delete" | "match" | "put"> {
	readonly entries = new Map<string, Response>();

	private cacheKey(input: RequestInfo | URL) {
		if (input instanceof Request) return input.url;
		if (input instanceof URL) return input.toString();
		return input;
	}

	async delete(input: RequestInfo | URL) {
		return this.entries.delete(this.cacheKey(input));
	}

	async match(input: RequestInfo | URL) {
		return this.entries.get(this.cacheKey(input))?.clone();
	}

	async put(input: RequestInfo | URL, response: Response) {
		this.entries.set(this.cacheKey(input), response.clone());
	}
}

function installMockCaches(cache: MemoryCache) {
	const hadCaches = "caches" in globalThis;
	const previousCaches = globalThis.caches;
	globalThis.caches = {
		open: async () => cache as unknown as Cache,
	} as unknown as CacheStorage;

	return () => {
		if (hadCaches) {
			globalThis.caches = previousCaches;
		} else {
			Reflect.deleteProperty(globalThis, "caches");
		}
	};
}

describe("anonymous Cloudflare page cache", () => {
	test("accepts anonymous page GET requests", () => {
		expect(isAnonymousPageCacheCandidate(request("/about/"))).toBe(true);
		expect(
			isAnonymousPageCacheCandidate(request("/about/?utm_source=test")),
		).toBe(true);
		expect(
			normalizePageCacheKey(
				new URL("https://example.com/about/?utm_source=test&b=2&a=1"),
			),
		).toBe("https://engaged-philosophy-cache.local/about/?a=1&b=2");
		expect(
			normalizePageCacheKey(
				new URL(
					"https://engaged-philosophy.ramona75.workers.dev/about/?utm_source=test",
				),
			),
		).toBe("https://engaged-philosophy-cache.local/about/");
	});

	test("rejects non-page and signed-in requests", () => {
		expect(
			isAnonymousPageCacheCandidate(request("/about/", { method: "POST" })),
		).toBe(false);
		expect(isAnonymousPageCacheCandidate(request("/_emdash/admin"))).toBe(
			false,
		);
		expect(
			isAnonymousPageCacheCandidate(request("/cdn-cgi/access/authorized")),
		).toBe(false);
		expect(isAnonymousPageCacheCandidate(request("/site.webmanifest"))).toBe(
			false,
		);
		expect(isAnonymousPageCacheCandidate(request("/?s=ethics"))).toBe(false);
		expect(
			isAnonymousPageCacheCandidate(
				request("/about/", { headers: { Cookie: "CF_Authorization=abc" } }),
			),
		).toBe(false);
		expect(
			isAnonymousPageCacheCandidate(
				request("/about/", {
					headers: { Cookie: "foo=bar; emdash-edit-mode=true" },
				}),
			),
		).toBe(false);
	});

	test("detects cookies that imply personalized state", () => {
		expect(hasStatefulCookie("CF_Authorization=abc")).toBe(true);
		expect(hasStatefulCookie("foo=bar; emdash-edit-mode=true")).toBe(true);
		expect(hasStatefulCookie("foo=bar; astro-session=abc")).toBe(true);
		expect(hasStatefulCookie("foo=bar; __em_d1_bookmark=abc")).toBe(true);
		expect(hasStatefulCookie("foo=bar; _ga=abc")).toBe(false);
	});

	test("normalizes path invalidation to stored cache keys", () => {
		expect(normalizePageCacheInvalidationKeys("/about/")).toEqual([
			"https://engaged-philosophy-cache.local/about/",
			"https://engaged-philosophy-cache.local/about",
		]);
		expect(normalizePageCacheInvalidationKeys("about")).toEqual([
			"https://engaged-philosophy-cache.local/about",
			"https://engaged-philosophy-cache.local/about/",
		]);
		expect(
			normalizePageCacheInvalidationKeys("/about/?utm_source=test"),
		).toEqual([
			"https://engaged-philosophy-cache.local/about/",
			"https://engaged-philosophy-cache.local/about",
		]);
	});

	test("invalidates cached pages by Astro cache tags", async () => {
		const cache = new MemoryCache();
		const restoreCaches = installMockCaches(cache);

		try {
			const provider = createCacheProvider({ cacheName: "test-pages" });
			let renderCount = 0;

			async function render() {
				renderCount += 1;
				return new Response(`render ${renderCount}`, {
					headers: {
						"Content-Type": "text/html",
						"CDN-Cache-Control": "max-age=300, stale-while-revalidate=86400",
						"Cache-Tag": "pages,content-123",
					},
				});
			}

			const context = {
				request: request("/about/"),
				url: new URL("https://engaged-philosophy.ramona75.workers.dev/about/"),
			};

			await expect(
				provider
					.onRequest?.(context, render)
					.then((response) => response.text()),
			).resolves.toBe("render 1");
			await expect(
				provider
					.onRequest?.(context, render)
					.then((response) => response.text()),
			).resolves.toBe("render 1");

			await provider.invalidate({ tags: "pages" });

			await expect(
				provider
					.onRequest?.(context, render)
					.then((response) => response.text()),
			).resolves.toBe("render 2");
		} finally {
			restoreCaches();
		}
	});

	test("does not store responses that upstream marks private", async () => {
		for (const cacheControl of [
			"private, no-store",
			'private="Set-Cookie", max-age=300',
		]) {
			const cache = new MemoryCache();
			const restoreCaches = installMockCaches(cache);

			try {
				const provider = createCacheProvider({ cacheName: "test-pages" });
				let renderCount = 0;

				async function render() {
					renderCount += 1;
					return new Response(`render ${renderCount}`, {
						headers: {
							"Content-Type": "text/html",
							"Cache-Control": cacheControl,
							"CDN-Cache-Control": "max-age=300, stale-while-revalidate=86400",
						},
					});
				}

				const context = {
					request: request("/about/"),
					url: new URL(
						"https://engaged-philosophy.ramona75.workers.dev/about/",
					),
				};

				await expect(
					provider
						.onRequest?.(context, render)
						.then((response) => response.text()),
				).resolves.toBe("render 1");
				await expect(
					provider
						.onRequest?.(context, render)
						.then((response) => response.text()),
				).resolves.toBe("render 2");
			} finally {
				restoreCaches();
			}
		}
	});
});
