import type { CacheProviderFactory, MiddlewareNext } from "astro";

const STORED_AT_HEADER = "X-EP-Cache-Stored-At";
const MAX_AGE_HEADER = "X-EP-Cache-Max-Age";
const SWR_HEADER = "X-EP-Cache-SWR";
const CACHE_TAG_HEADER = "Cache-Tag";
const INTERNAL_HEADERS = [STORED_AT_HEADER, MAX_AGE_HEADER, SWR_HEADER];
const MAX_AGE_REGEX = /max-age=(\d+)/;
const SWR_REGEX = /stale-while-revalidate=(\d+)/;
const CACHE_CONTROL_SPLIT_REGEX = /\s*,\s*/;
const HTML_CONTENT_TYPE_REGEX = /(?:^|;)\s*text\/html(?:;|$)/i;
const CACHE_KEY_ORIGIN = "https://engaged-philosophy-cache.local";
const TAG_INDEX_PATH_PREFIX = "/__ep-cache-tags/";

const TRACKING_PARAMS = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
	"fbclid",
	"gclid",
	"gbraid",
	"wbraid",
	"dclid",
	"msclkid",
	"twclid",
	"_ga",
	"_gl",
];

const STATEFUL_COOKIE_NAMES = [
	"astro-session",
	"CF_Authorization",
	"CF_AppSession",
	"CF_Session",
	"emdash-edit-mode",
	"emdash_preview",
	"emdash_preview_params",
	"emdash_wp_auth",
	"__em_d1_bookmark",
];

const BYPASS_PATH_PREFIXES = ["/_astro/", "/_emdash", "/cdn-cgi/"];

const BYPASS_FILE_EXTENSIONS = new Set([
	".avif",
	".css",
	".gif",
	".ico",
	".jpeg",
	".jpg",
	".js",
	".json",
	".map",
	".pdf",
	".png",
	".svg",
	".txt",
	".webmanifest",
	".webp",
	".xml",
]);

export interface AnonymousCloudflareCacheConfig {
	cacheName?: string;
}

function getCookieNames(cookieHeader: string): string[] {
	if (!cookieHeader) return [];
	return cookieHeader
		.split(";")
		.map((cookie) => cookie.trim().split("=", 1)[0])
		.filter(Boolean);
}

export function hasStatefulCookie(cookieHeader: string | null): boolean {
	const names = getCookieNames(cookieHeader ?? "");
	return names.some((name) => STATEFUL_COOKIE_NAMES.includes(name));
}

function hasNonTrackingSearchParam(url: URL): boolean {
	const trackingParams = new Set(TRACKING_PARAMS);
	for (const key of url.searchParams.keys()) {
		if (!trackingParams.has(key)) return true;
	}
	return false;
}

function hasBypassedFileExtension(pathname: string): boolean {
	const extension = pathname.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
	return extension ? BYPASS_FILE_EXTENSIONS.has(extension) : false;
}

export function isAnonymousPageCacheCandidate(
	request: Request,
	url = new URL(request.url),
): boolean {
	if (request.method !== "GET") return false;
	if (hasStatefulCookie(request.headers.get("Cookie"))) return false;
	if (BYPASS_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
		return false;
	}
	if (hasBypassedFileExtension(url.pathname)) return false;
	if (hasNonTrackingSearchParam(url)) return false;
	return true;
}

export function normalizePageCacheKey(url: URL): string {
	const normalized = new URL(`${url.pathname}${url.search}`, CACHE_KEY_ORIGIN);
	for (const param of TRACKING_PARAMS) {
		normalized.searchParams.delete(param);
	}
	normalized.searchParams.sort();
	return normalized.toString();
}

function cacheUrlFromPath(path: string) {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return new URL(normalizedPath, CACHE_KEY_ORIGIN);
}

export function normalizePageCacheInvalidationKeys(path: string): string[] {
	const url = cacheUrlFromPath(path);
	const keys = new Set([normalizePageCacheKey(url)]);

	if (url.search) {
		url.search = "";
		keys.add(normalizePageCacheKey(url));
	}

	const hasExtension = /\.[a-z0-9]+$/i.test(url.pathname);
	if (!hasExtension && url.pathname !== "/") {
		const slashVariant = new URL(url.toString());
		slashVariant.pathname = slashVariant.pathname.endsWith("/")
			? slashVariant.pathname.slice(0, -1)
			: `${slashVariant.pathname}/`;
		keys.add(normalizePageCacheKey(slashVariant));
	}

	return [...keys];
}

function parseCdnCacheControl(header: string | null): {
	maxAge: number;
	swr: number;
} {
	const maxAgeMatch = header?.match(MAX_AGE_REGEX);
	const swrMatch = header?.match(SWR_REGEX);
	return {
		maxAge: maxAgeMatch ? Number.parseInt(maxAgeMatch[1] ?? "0", 10) : 0,
		swr: swrMatch ? Number.parseInt(swrMatch[1] ?? "0", 10) : 0,
	};
}

function parseCacheTags(header: string | null): string[] {
	if (!header) return [];
	return header
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);
}

function stripInternalHeaders(response: Response) {
	for (const header of INTERNAL_HEADERS) {
		response.headers.delete(header);
	}
}

function hasSetCookie(response: Response): boolean {
	return response.headers.getSetCookie().length > 0;
}

function isCacheableHtmlResponse(response: Response): boolean {
	const contentType = response.headers.get("Content-Type") ?? "";
	return response.status === 200 && HTML_CONTENT_TYPE_REGEX.test(contentType);
}

function responseDisallowsSharedCache(response: Response): boolean {
	for (const header of ["Cache-Control", "CDN-Cache-Control"]) {
		const directives = response.headers
			.get(header)
			?.split(CACHE_CONTROL_SPLIT_REGEX)
			.map((directive) => directive.split("=", 1)[0]?.trim().toLowerCase());
		if (directives?.includes("no-store") || directives?.includes("private")) {
			return true;
		}
	}
	return false;
}

function prepareForCache(
	response: Response,
	maxAge: number,
	swr: number,
): Response | null {
	if (
		!isCacheableHtmlResponse(response) ||
		hasSetCookie(response) ||
		responseDisallowsSharedCache(response)
	) {
		return null;
	}
	const prepared = new Response(response.body, response);
	prepared.headers.set(STORED_AT_HEADER, String(Date.now()));
	prepared.headers.set(MAX_AGE_HEADER, String(maxAge));
	prepared.headers.set(SWR_HEADER, String(swr));
	prepared.headers.delete("Set-Cookie");
	return prepared;
}

function mark(response: Response, status: "HIT" | "MISS" | "STALE") {
	response.headers.set("X-EP-Cache", status);
	return response;
}

function tagIndexKey(tag: string) {
	const url = new URL(
		`${TAG_INDEX_PATH_PREFIX}${encodeURIComponent(tag)}`,
		CACHE_KEY_ORIGIN,
	);
	return url.toString();
}

async function readTagIndex(cache: Cache, tag: string): Promise<Set<string>> {
	const response = await cache.match(tagIndexKey(tag));
	if (!response) return new Set();

	try {
		const keys = (await response.json()) as unknown;
		return new Set(
			Array.isArray(keys)
				? keys.filter((key): key is string => typeof key === "string")
				: [],
		);
	} catch {
		return new Set();
	}
}

async function writeTagIndex(cache: Cache, tag: string, keys: Set<string>) {
	const indexKey = tagIndexKey(tag);
	if (keys.size === 0) {
		await cache.delete(indexKey);
		return;
	}

	await cache.put(
		indexKey,
		Response.json([...keys], {
			headers: {
				"Cache-Control": "no-store",
			},
		}),
	);
}

async function indexCacheTags(cache: Cache, cacheKey: string, tags: string[]) {
	for (const tag of tags) {
		const keys = await readTagIndex(cache, tag);
		keys.add(cacheKey);
		await writeTagIndex(cache, tag, keys);
	}
}

async function renderAndStore(
	cache: Cache,
	cacheKey: string,
	next: MiddlewareNext,
): Promise<Response> {
	const response = await next();
	const { maxAge, swr } = parseCdnCacheControl(
		response.headers.get("CDN-Cache-Control"),
	);
	const tags = parseCacheTags(response.headers.get(CACHE_TAG_HEADER));

	if (maxAge <= 0) return response;

	const toStore = prepareForCache(response.clone(), maxAge, swr);
	if (!toStore) return response;

	await cache.put(cacheKey, toStore);
	await indexCacheTags(cache, cacheKey, tags);
	return mark(new Response(response.body, response), "MISS");
}

const factory: CacheProviderFactory<AnonymousCloudflareCacheConfig> = (
	config,
) => {
	const cacheName = config?.cacheName ?? "engaged-philosophy-pages";

	async function getCache(): Promise<Cache> {
		return caches.open(cacheName);
	}

	return {
		name: "anonymous-cloudflare-page-cache",

		async onRequest(context, next) {
			if (!isAnonymousPageCacheCandidate(context.request, context.url)) {
				return next();
			}

			const cacheKey = normalizePageCacheKey(context.url);
			const cache = await getCache();
			const cached = await cache.match(cacheKey);

			if (cached) {
				const storedAt = Number.parseInt(
					cached.headers.get(STORED_AT_HEADER) ?? "0",
					10,
				);
				const maxAge = Number.parseInt(
					cached.headers.get(MAX_AGE_HEADER) ?? "0",
					10,
				);
				const swr = Number.parseInt(cached.headers.get(SWR_HEADER) ?? "0", 10);
				const ageSeconds = Math.max(
					0,
					Math.floor((Date.now() - storedAt) / 1000),
				);

				if (ageSeconds < maxAge) {
					const hit = mark(new Response(cached.body, cached), "HIT");
					hit.headers.set("Age", String(ageSeconds));
					stripInternalHeaders(hit);
					return hit;
				}

				if (swr > 0 && ageSeconds < maxAge + swr) {
					const stale = mark(new Response(cached.body, cached), "STALE");
					stale.headers.set("Age", String(ageSeconds));
					stripInternalHeaders(stale);

					context.waitUntil?.(
						renderAndStore(cache, cacheKey, next).catch(() => undefined),
					);

					return stale;
				}

				await cache.delete(cacheKey);
			}

			return renderAndStore(cache, cacheKey, next);
		},

		async invalidate(options) {
			if (options.path) {
				const cache = await getCache();
				for (const cacheKey of normalizePageCacheInvalidationKeys(
					options.path,
				)) {
					await cache.delete(cacheKey);
				}
			}
			if (options.tags) {
				const cache = await getCache();
				const tags = Array.isArray(options.tags)
					? options.tags
					: [options.tags];
				for (const tag of tags) {
					const cacheKeys = await readTagIndex(cache, tag);
					for (const cacheKey of cacheKeys) {
						await cache.delete(cacheKey);
					}
					await cache.delete(tagIndexKey(tag));
				}
			}
		},
	};
};

export default factory;
