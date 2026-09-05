import { describe, expect, test } from "vitest";

import { applyPublicRequestPolicy } from "../../src/lib/public-request-policy";
import {
	MAX_SEARCH_CURSOR_HISTORY,
	MAX_SEARCH_QUERY_LENGTH,
} from "../../src/lib/search";

function apply(path: string, init?: RequestInit) {
	return applyPublicRequestPolicy(
		new Request(`https://www.engagedphilosophy.com${path}`, init),
	);
}

describe("public request policy", () => {
	test("leaves EmDash and image optimization requests untouched", () => {
		const request = new Request(
			"https://www.engagedphilosophy.com/_emdash/api/content?page=2",
			{ method: "POST" },
		);
		const imageRequest = new Request(
			"https://www.engagedphilosophy.com/_image?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2Fexample.png&w=400&f=webp",
		);

		expect(applyPublicRequestPolicy(request)).toEqual({ request });
		expect(applyPublicRequestPolicy(imageRequest)).toEqual({
			request: imageRequest,
		});
	});

	test("rejects unsupported public methods before rendering", async () => {
		const { response } = apply("/about/", { method: "POST" });

		expect(response?.status).toBe(405);
		expect(response?.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
		await expect(response?.text()).resolves.toBe("Method not allowed.\n");
	});

	test("answers public preflight requests without rendering", () => {
		const { response } = apply("/about/", { method: "OPTIONS" });

		expect(response?.status).toBe(204);
		expect(response?.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
	});

	test("rejects scanner probe paths before rendering", async () => {
		for (const path of [
			"/.env.production",
			"/phpinfo.php~",
			"/webroot/index.php/_environment",
			"/_ENVIRONMENT",
			"/_profiler/phpinfo/",
			"/api/graphql",
			"/v1/graphql/",
			"/WP/",
			"/wordpress/wp-admin/install.php",
			"/vendor/phpunit/src/Util/PHP/eval-stdin.php",
		]) {
			const { response } = apply(path);
			expect(response?.status, path).toBe(404);
			expect(response?.headers.get("cache-control"), path).toBe(
				"public, max-age=300",
			);
			await expect(response?.text(), path).resolves.toBe("Not found.\n");
		}
	});

	test("preserves legitimate legacy and framework paths", () => {
		expect(apply("/wp-content/uploads/example.jpg").response).toBeUndefined();
		expect(apply("/project/phpinfo-documentary/").response).toBeUndefined();
		expect(
			apply("/_emdash/api/graphql", { method: "POST" }).response,
		).toBeUndefined();
	});

	test("rejects oversized and malformed request targets", () => {
		expect(apply(`/about/?value=${"x".repeat(2049)}`).response?.status).toBe(
			414,
		);
		expect(
			apply(`/${Array.from({ length: 17 }, () => "a").join("/")}`).response
				?.status,
		).toBe(400);
		expect(apply("/%E0%A4%A").response?.status).toBe(400);
	});

	test("removes irrelevant query parameters before rendering", () => {
		const { request, response } = apply("/about/?utm_source=test&random=1");

		expect(response).toBeUndefined();
		expect(new URL(request.url).search).toBe("");
	});

	test("canonicalizes search requests and rejects excessive searches", () => {
		const canonical = apply("/?utm_source=test&s=%20community%20");
		expect(canonical.response?.status).toBe(308);
		expect(canonical.response?.headers.get("location")).toBe(
			"https://www.engagedphilosophy.com/?s=community",
		);

		const excessive = apply(`/?s=${"x".repeat(MAX_SEARCH_QUERY_LENGTH + 1)}`);
		expect(excessive.response?.status).toBe(400);
	});

	test("validates search cursors and page history before rendering", () => {
		const valid = apply("/page/2/?s=community&cursor=next&before=");
		expect(valid.response).toBeUndefined();

		const missingHistory = apply("/page/2/?s=community&cursor=next");
		expect(missingHistory.response?.status).toBe(404);

		const excessivePage = apply(
			`/page/${MAX_SEARCH_CURSOR_HISTORY + 2}/?s=community&cursor=next`,
		);
		expect(excessivePage.response?.status).toBe(404);
	});

	test("preserves well-formed previews and rejects malformed preview tokens", () => {
		const token = `payload.${"x".repeat(43)}`;
		const preview = apply(`/about/?_preview=${token}&utm_source=test`);
		expect(preview.response).toBeUndefined();
		expect(new URL(preview.request.url).searchParams.get("_preview")).toBe(
			token,
		);

		expect(apply("/about/?_preview=not-signed").response?.status).toBe(400);
	});

	test("redirects anonymous edit requests but preserves authenticated ones", () => {
		const anonymous = apply("/about/?_edit=1&utm_source=test");
		expect(anonymous.response?.status).toBe(302);
		expect(anonymous.response?.headers.get("location")).toBe(
			"https://www.engagedphilosophy.com/about/?utm_source=test",
		);

		const authenticated = apply("/about/?_edit=1", {
			headers: { cookie: "CF_Authorization=token" },
		});
		expect(authenticated.response).toBeUndefined();
	});
});
