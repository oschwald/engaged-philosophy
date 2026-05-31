import assert from "node:assert/strict";

import { getObservedRequestInfo } from "../src/lib/admin-request-observability.ts";

function request(path: string, cookie = "") {
	return new Request(`https://example.com${path}`, {
		headers: cookie ? { Cookie: cookie } : {},
	});
}

assert.equal(getObservedRequestInfo(request("/about/"), "req-public"), null);

const adminInfo = getObservedRequestInfo(
	request("/_emdash/admin?redirect=/about/&nonce=secret"),
	"req-admin",
);
assert.ok(adminInfo);
assert.equal(adminInfo.requestId, "req-admin");
assert.equal(adminInfo.path, "/_emdash/admin");
assert.deepEqual(adminInfo.queryKeys, ["nonce", "redirect"]);
assert.deepEqual(adminInfo.reasons, ["emdash-route"]);

const signedInInfo = getObservedRequestInfo(
	request(
		"/about/?draft=true",
		"astro-session=session-secret; CF_Authorization=jwt-secret; emdash-edit-mode=true; __em_d1_bookmark=bookmark-secret",
	),
	"req-signed-in",
);
assert.ok(signedInInfo);
assert.equal(signedInInfo.path, "/about/");
assert.deepEqual(signedInInfo.queryKeys, ["draft"]);
assert.equal(signedInInfo.cookieFlags.astroSession, true);
assert.equal(signedInInfo.cookieFlags.cloudflareAccess, true);
assert.equal(signedInInfo.cookieFlags.editMode, true);
assert.equal(signedInInfo.cookieFlags.d1Bookmark, true);

const serialized = JSON.stringify(signedInInfo);
assert.equal(serialized.includes("session-secret"), false);
assert.equal(serialized.includes("jwt-secret"), false);
assert.equal(serialized.includes("bookmark-secret"), false);

console.log("admin observability tests passed");
