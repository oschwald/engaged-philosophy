import { describe, expect, test } from "vitest";

import {
	applyPublicRequestPolicy,
	canonicalizeRedirect,
} from "../../src/lib/public-request-policy";
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
			"/.%65nv",
			"/.env%2eproduction",
			"/.env.production",
			"/%70hpinfo",
			"/phpinfo.php~",
			"/webroot/index.php/_environment",
			"/_ENVIRONMENT",
			"/_profiler/phpinfo/",
			"/api/graphql",
			"/v1/graphql/",
			"/WP/",
			"/wordpress/wp-admin/install.php",
			"/vendor/phpunit/src/Util/PHP/eval-stdin.php",
			"/api/.env",
			"/api/shared/.env.production",
			"/staging/.env~",
			"/api%2F.%65nv",
			"/config/.AWS/credentials",
			"/.DOCKER/config.json/",
			"/.kube/config",
			"/.terraform/credentials.tfrc.json",
			"/.vscode/sftp.json",
			"/backup/.git/config",
			"/backup/.hg/hgrc",
			"/backup/.svn/entries",
			"/.boto",
			"/.my.cnf",
			"/terraform.tfstate.backup",
			"/appsettings.Development.json",
			"/s3.properties",
			"/sftp-config.json",
			"/assets/plugins/jQuery-File-Upload/server/php/",
			"/blueimp-jQuery-File-Upload/server/php",
			"/assets/vendor/jquery.filer/php/readme.txt",
			"/ALFA_DATA/alfacgiapi/perl.alfa",
			"/file-manager/initialize",
			"/config%2etxt",
			"/CONFIG.ini~",
			"/env%2ejson%2ebak",
			"/env.tmp",
			"/vault",
			"/vault-init",
			"/vault/secrets",
			"/run/secrets/",
			"/run/secrets/kubernetes.io/serviceaccount/token",
			"/var/run/secrets/kubernetes.io/serviceaccount/namespace",
			"/pgpass",
			"/stripe-secret-key",
			"/stripe-webhook-secret/",
			"/stripe_api_key",
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
		for (const path of [
			"/.well-known/traffic-advice",
			"/.well-known/acme-challenge/token",
			"/project/environmental-ethics/",
			"/project/.environment/",
			"/project/terraforming/",
			"/wp-content/uploads/2026/09/configuration.pdf",
			"/wp-content/uploads/2026/09/environment.php.jpg",
			"/_astro/site.js",
			"/_emdash/api/media/file/.env",
			"/_emdash/api/media/file/config.json",
			"/project/vault/",
			"/project/stripe-patterns/",
			"/wp-content/uploads/2026/09/config.txt",
			"/environment/",
			"/configuration/",
			"/vaulting/",
		]) {
			expect(apply(path).response, path).toBeUndefined();
		}
	});

	test("returns a bodyless response for HEAD probes", async () => {
		const { response } = apply("/api/.env", { method: "HEAD" });
		expect(response?.status).toBe(404);
		await expect(response?.text()).resolves.toBe("");
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

	test("redirects pages to their trailing-slash form", () => {
		for (const method of ["GET", "HEAD"]) {
			const page = apply("/2026/11/24/bracket-post", { method });
			expect(page.response?.status, method).toBe(301);
			expect(page.response?.headers.get("location"), method).toBe(
				"/2026/11/24/bracket-post/",
			);
			expect(page.response?.headers.get("cache-control"), method).toBe(
				"public, max-age=300",
			);
		}

		for (const slug of ["web-3.0", "notes.v2"]) {
			expect(
				apply(`/2026/11/24/${slug}`).response?.headers.get("location"),
				slug,
			).toBe(`/2026/11/24/${slug}/`);
		}

		const withQuery = apply("/about?utm_source=test");
		expect(withQuery.response?.status).toBe(301);
		expect(withQuery.response?.headers.get("location")).toBe("/about/");

		expect(apply("/feed").response?.headers.get("location")).toBe("/feed/");
		expect(apply("/2026/11/24/bracket-post/").response).toBeUndefined();
	});

	test("keeps file, reserved, and preview paths in their requested form", () => {
		const token = `payload.${"x".repeat(43)}`;
		for (const path of [
			"/",
			"/sitemap.xml",
			"/robots.txt",
			"/favicon.ico",
			"/site.webmanifest",
			"/wp-content/uploads/2026/09/example.jpg",
			"/wp-content/uploads/2014/02/lecture.avi",
			"/static/js/main.min.js",
			"/img/sprite",
			"/IMG/raw.bin",
			"/wp-includes/js/thing",
			"/cdn-cgi/local/scheduled",
			"/2014/02/photo.jpg",
			"/2026/11/24/old-page.html",
			"/img/logo.png",
			"/IMG/logo.png",
			"/google1234abcd.html",
			"//evil.example",
			"/\\evil.example",
			"/.well-known/traffic-advice",
			"/_astro/site.js",
			"/_server-islands/Example",
			`/projects/project-id?_preview=${token}`,
		]) {
			expect(apply(path).response, path).toBeUndefined();
		}
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

		const withoutSlash = apply("/page/2?s=community&cursor=next&before=");
		expect(withoutSlash.response?.status).toBe(308);
		expect(withoutSlash.response?.headers.get("location")).toBe(
			"https://www.engagedphilosophy.com/page/2/?s=community&cursor=next&before=",
		);

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

		const slashless = apply("/about?_edit=1");
		expect(slashless.response?.status).toBe(302);
		expect(slashless.response?.headers.get("location")).toBe(
			"https://www.engagedphilosophy.com/about/",
		);

		const authenticated = apply("/about/?_edit=1", {
			headers: { cookie: "CF_Authorization=token" },
		});
		expect(authenticated.response).toBeUndefined();
	});

	test("points the app's permanent redirects at the slash form", () => {
		const redirect = (status: number, location: string) =>
			canonicalizeRedirect(
				new Request("https://www.engagedphilosophy.com/2022/05/31/old-slug/"),
				new Response(null, { status, headers: { Location: location } }),
			).headers.get("location");

		expect(redirect(301, "/2022/05/31/renamed")).toBe("/2022/05/31/renamed/");
		expect(redirect(308, "/project/renamed?ref=1#top")).toBe(
			"/project/renamed/?ref=1#top",
		);
		for (const location of [
			"/project/renamed/",
			"/papers/lecture.pdf",
			"/wp-content/uploads/2014/02/paper.pdf",
			"/_emdash/api/media/file/logo.png",
			"//evil.example",
			"/\\evil.example",
			"/\t/evil.example",
			"https://example.com/elsewhere",
		]) {
			expect(redirect(301, location)).toBe(location);
		}
		expect(redirect(302, "/projects/id?_preview=token")).toBe(
			"/projects/id?_preview=token",
		);
		expect(redirect(301, "/\\exa mple")).toBe("/\\exa mple");
	});
});
