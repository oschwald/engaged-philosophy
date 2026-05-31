import assert from "node:assert/strict";

import {
	hasStatefulCookie,
	isAnonymousPageCacheCandidate,
	normalizePageCacheKey,
} from "../src/lib/anonymous-cloudflare-cache.ts";

function request(path: string, init: RequestInit = {}) {
	return new Request(
		`https://engaged-philosophy.ramona75.workers.dev${path}`,
		init,
	);
}

assert.equal(isAnonymousPageCacheCandidate(request("/about/")), true);
assert.equal(
	isAnonymousPageCacheCandidate(request("/about/?utm_source=test")),
	true,
);
assert.equal(
	normalizePageCacheKey(
		new URL("https://example.com/about/?utm_source=test&b=2&a=1"),
	),
	"https://example.com/about/?a=1&b=2",
);

assert.equal(
	isAnonymousPageCacheCandidate(request("/about/", { method: "POST" })),
	false,
);
assert.equal(isAnonymousPageCacheCandidate(request("/_emdash/admin")), false);
assert.equal(
	isAnonymousPageCacheCandidate(request("/cdn-cgi/access/authorized")),
	false,
);
assert.equal(
	isAnonymousPageCacheCandidate(request("/site.webmanifest")),
	false,
);
assert.equal(isAnonymousPageCacheCandidate(request("/?s=ethics")), false);

assert.equal(hasStatefulCookie("CF_Authorization=abc"), true);
assert.equal(hasStatefulCookie("foo=bar; emdash-edit-mode=true"), true);
assert.equal(hasStatefulCookie("foo=bar; astro-session=abc"), true);
assert.equal(hasStatefulCookie("foo=bar; __em_d1_bookmark=abc"), true);
assert.equal(hasStatefulCookie("foo=bar; _ga=abc"), false);

assert.equal(
	isAnonymousPageCacheCandidate(
		request("/about/", { headers: { Cookie: "CF_Authorization=abc" } }),
	),
	false,
);
assert.equal(
	isAnonymousPageCacheCandidate(
		request("/about/", {
			headers: { Cookie: "foo=bar; emdash-edit-mode=true" },
		}),
	),
	false,
);

console.log("anonymous cache tests passed");
