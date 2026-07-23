import assert from "node:assert/strict";
import fs from "node:fs";

const DEFAULT_BASE_URL = "https://engaged-philosophy.ramona75.workers.dev";
const REQUEST_TIMEOUT_MS = Number.parseInt(
	process.env.LIVE_SMOKE_TIMEOUT_MS ?? "12000",
	10,
);
const PUBLIC_PATHS = parseList(process.env.LIVE_SMOKE_PATHS, [
	"/",
	"/about/",
	"/blog/",
	"/project/",
]);
const STATIC_PATHS = parseList(process.env.LIVE_SMOKE_STATIC_PATHS, [
	"/favicon.ico",
	"/site.webmanifest",
]);
const MEDIA_URLS = parseList(process.env.LIVE_SMOKE_MEDIA_URLS, []);
const BASE_URL = normalizeBaseUrl(
	process.env.LIVE_BASE_URL ?? DEFAULT_BASE_URL,
);
const ADMIN_COOKIE = process.env.LIVE_SMOKE_ADMIN_COOKIE;
const CHECK_SITEMAP = process.env.LIVE_SMOKE_SITEMAP === "1";
const REQUIRE_SITEMAP = process.env.LIVE_SMOKE_REQUIRE_SITEMAP === "1";
const SITEMAP_LIMIT = Number.parseInt(
	process.env.LIVE_SMOKE_SITEMAP_LIMIT ?? "0",
	10,
);
const PATH_FILE = process.env.LIVE_SMOKE_PATH_FILE;
const CHECK_CONCURRENCY = Math.max(
	1,
	Number.parseInt(process.env.LIVE_SMOKE_CONCURRENCY ?? "6", 10),
);

function parseList(value, fallback) {
	if (!value) return fallback;
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function normalizeBaseUrl(value) {
	return value.replace(/\/+$/, "");
}

function absoluteUrl(pathOrUrl) {
	if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
	return `${BASE_URL}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function statusLabel(response) {
	return `${response.status} ${response.statusText}`.trim();
}

function parseSitemapLocations(xml) {
	return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) =>
		(match[1] ?? "").trim(),
	);
}

function toBaseUrl(url) {
	const parsed = new URL(url, BASE_URL);
	return new URL(`${parsed.pathname}${parsed.search}`, BASE_URL).toString();
}

function toPath(pathOrUrl) {
	const parsed = new URL(pathOrUrl, BASE_URL);
	return `${parsed.pathname}${parsed.search}`;
}

function normalizeSmokePath(pathOrUrl) {
	const path = toPath(pathOrUrl).replace(/\/{2,}/g, "/");
	return path || "/";
}

async function fetchWithTimeout(url, init = {}) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		return await fetch(url, {
			...init,
			signal: controller.signal,
		});
	} catch (error) {
		if (error?.name === "AbortError") {
			throw new Error(
				`Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${url}`,
			);
		}
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}

async function expectOk(url, label, init = {}) {
	const response = await fetchWithTimeout(url, init);
	assert.equal(
		response.ok,
		true,
		`${label} expected 2xx, got ${statusLabel(response)} for ${url}`,
	);
	return response;
}

async function checkPublicPage(path) {
	const url = absoluteUrl(path);
	const response = await expectOk(url, `Public page ${path}`);
	const text = await response.text();

	assert.match(
		response.headers.get("content-type") ?? "",
		/text\/html/i,
		`Public page ${path} should return HTML`,
	);
	assert.equal(
		response.headers.has("set-cookie"),
		false,
		`Anonymous public page ${path} should not set cookies`,
	);
	assert.equal(
		text.includes("Authentication required"),
		false,
		`Anonymous public page ${path} rendered an auth-required message`,
	);
	assert.equal(
		text.includes("[gallery") || text.includes("[embed]"),
		false,
		`Public page ${path} appears to contain unrendered legacy shortcode text`,
	);
	assert.equal(
		/href=["']\/favicon(?:-simple)?\.svg["']/i.test(text),
		false,
		`Public page ${path} should not advertise the removed SVG favicon`,
	);

	console.log(`ok public ${path}`);
}

async function checkPublicPages(paths) {
	const queue = [...new Set(paths.map(normalizeSmokePath))];
	let index = 0;

	await Promise.all(
		Array.from(
			{ length: Math.min(CHECK_CONCURRENCY, queue.length) },
			async () => {
				while (index < queue.length) {
					const path = queue[index];
					index += 1;
					await checkPublicPage(path);
				}
			},
		),
	);
}

async function getSitemapPageUrls() {
	const sitemapUrl = absoluteUrl("/sitemap.xml");
	const response = await expectOk(sitemapUrl, "Sitemap");
	const xml = await response.text();
	const locations = parseSitemapLocations(xml);
	const sitemapLocations = locations.filter((location) =>
		location.endsWith(".xml"),
	);
	const pageLocations = locations
		.filter((location) => !location.endsWith(".xml"))
		.map(toBaseUrl);

	for (const location of sitemapLocations.map(toBaseUrl)) {
		const childResponse = await expectOk(location, `Sitemap ${location}`);
		const childXml = await childResponse.text();
		pageLocations.push(
			...parseSitemapLocations(childXml)
				.filter((childLocation) => !childLocation.endsWith(".xml"))
				.map(toBaseUrl),
		);
	}

	const sameOriginPages = [...new Set(pageLocations)];
	return SITEMAP_LIMIT > 0
		? sameOriginPages.slice(0, SITEMAP_LIMIT)
		: sameOriginPages;
}

async function checkSitemapPages() {
	if (!CHECK_SITEMAP) return;

	const urls = await getSitemapPageUrls();
	if (urls.length === 0) {
		assert.equal(
			REQUIRE_SITEMAP,
			false,
			"Expected sitemap to include public page URLs",
		);
		console.log("skip sitemap pages (no URLs found)");
		return;
	}

	await checkPublicPages(urls.map((url) => new URL(url).pathname));

	console.log(`ok sitemap pages ${urls.length}`);
}

function getPathFilePages() {
	if (!PATH_FILE) return [];
	if (!fs.existsSync(PATH_FILE)) {
		throw new Error(`LIVE_SMOKE_PATH_FILE does not exist: ${PATH_FILE}`);
	}

	return fs
		.readFileSync(PATH_FILE, "utf8")
		.split(/\r?\n/)
		.map((line) => line.replace(/#.*/, "").trim())
		.filter(Boolean)
		.map(normalizeSmokePath);
}

async function checkPathFilePages() {
	const paths = getPathFilePages();
	if (paths.length === 0) return;

	await checkPublicPages(paths);
	console.log(`ok path file pages ${paths.length}`);
}

async function checkStaticAsset(path) {
	const url = absoluteUrl(path);
	const response = await expectOk(url, `Static asset ${path}`, {
		redirect: "follow",
	});

	assert.equal(
		response.headers.has("set-cookie"),
		false,
		`Static asset ${path} should not set cookies`,
	);
	console.log(`ok static ${path}`);
}

async function checkCacheSignal(path) {
	const url = absoluteUrl(path);
	const first = await expectOk(url, `Cache probe ${path}`);
	const second = await expectOk(url, `Cache probe ${path}`);
	const cacheStatuses = [first, second].map(
		(response) => response.headers.get("cf-cache-status") ?? "",
	);

	for (const cacheStatus of cacheStatuses) {
		assert.match(
			cacheStatus,
			/^(HIT|MISS|EXPIRED|STALE|UPDATING|REVALIDATED)$/i,
			`Cache probe ${path} returned unexpected CF-Cache-Status: ${cacheStatus || "none"}`,
		);
	}
	assert.match(
		cacheStatuses[1],
		/^(HIT|STALE|UPDATING|REVALIDATED)$/i,
		`Second cache probe ${path} should be served from cache, got ${cacheStatuses[1]}`,
	);
	console.log(`ok cache ${path} (${cacheStatuses.join(", ")})`);
}

function isAllowedAdminRedirect(location) {
	if (!location) return false;
	const base = new URL(BASE_URL);
	const target = new URL(location, base);

	return (
		target.hostname === base.hostname ||
		target.hostname.endsWith(".cloudflareaccess.com")
	);
}

async function checkAdminAccessRedirect() {
	const url = absoluteUrl("/_emdash/admin");
	const response = await fetchWithTimeout(url, { redirect: "manual" });

	assert.equal(
		response.status < 500,
		true,
		`Admin access check expected non-5xx, got ${statusLabel(response)}`,
	);
	assert.notEqual(response.status, 404, "Admin access check should not 404");

	if ([301, 302, 303, 307, 308].includes(response.status)) {
		const location = response.headers.get("location");
		assert.equal(
			isAllowedAdminRedirect(location),
			true,
			`Admin access redirected to unexpected location: ${location ?? "none"}`,
		);
	}

	console.log(`ok admin access ${response.status}`);
}

async function checkSignedInAdminIfConfigured() {
	if (!ADMIN_COOKIE) return;

	const response = await fetchWithTimeout(absoluteUrl("/_emdash/admin"), {
		headers: { Cookie: ADMIN_COOKIE },
		redirect: "manual",
	});
	assert.equal(
		response.status < 500,
		true,
		`Signed-in admin check expected non-5xx, got ${statusLabel(response)}`,
	);
	assert.notEqual(response.status, 404, "Signed-in admin check should not 404");
	console.log(`ok signed-in admin ${response.status}`);
}

console.log(`Running live smoke checks against ${BASE_URL}`);

await checkPublicPages(PUBLIC_PATHS);

await checkCacheSignal(
	PUBLIC_PATHS.includes("/about/") ? "/about/" : PUBLIC_PATHS[0],
);

for (const path of STATIC_PATHS) {
	await checkStaticAsset(path);
}

for (const url of MEDIA_URLS) {
	await checkStaticAsset(url);
}

await checkAdminAccessRedirect();
await checkSignedInAdminIfConfigured();
await checkSitemapPages();
await checkPathFilePages();

console.log("Live smoke checks passed.");
