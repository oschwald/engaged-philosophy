import assert from "node:assert/strict";

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
	"/favicon.svg",
	"/site.webmanifest",
]);
const MEDIA_URLS = parseList(process.env.LIVE_SMOKE_MEDIA_URLS, []);
const BASE_URL = normalizeBaseUrl(
	process.env.LIVE_BASE_URL ?? DEFAULT_BASE_URL,
);
const ADMIN_COOKIE = process.env.LIVE_SMOKE_ADMIN_COOKIE;

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

	console.log(`ok public ${path}`);
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
	const epCache =
		second.headers.get("x-ep-cache") ?? first.headers.get("x-ep-cache") ?? "";
	const cfCache =
		second.headers.get("cf-cache-status") ??
		first.headers.get("cf-cache-status") ??
		"";

	assert.match(
		epCache,
		/^(HIT|MISS|STALE)$/i,
		`Cache probe ${path} should expose X-EP-Cache, got ${epCache || "none"}`,
	);
	if (cfCache) {
		assert.match(
			cfCache,
			/^(HIT|MISS|EXPIRED|STALE|BYPASS|DYNAMIC|REVALIDATED)$/i,
			`Cache probe ${path} returned unexpected CF-Cache-Status: ${cfCache}`,
		);
	}
	console.log(`ok cache ${path} (${epCache}${cfCache ? `, ${cfCache}` : ""})`);
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

for (const path of PUBLIC_PATHS) {
	await checkPublicPage(path);
}

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

console.log("Live smoke checks passed.");
