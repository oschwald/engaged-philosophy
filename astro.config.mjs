import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { fileURLToPath } from "node:url";

import {
	ANONYMOUS_PAGE_CACHE_NAME,
	CLOUDFLARE_ACCESS_TEAM_DOMAIN,
	PUBLIC_MEDIA_URL,
} from "./src/lib/site-config.ts";

const embedsPluginEntrypoint = fileURLToPath(
	new URL("./src/plugins/embeds.ts", import.meta.url),
);
const auditLogPluginEntrypoint = fileURLToPath(
	new URL("./src/plugins/audit-log.ts", import.meta.url),
);
const legacyImagePluginEntrypoint = fileURLToPath(
	new URL("./src/plugins/legacy-image-blocks.ts", import.meta.url),
);
const legacyImagePluginAdminEntrypoint = fileURLToPath(
	new URL("./src/plugins/legacy-image-blocks-admin.ts", import.meta.url),
);
const cloudflareAccessAuthEntrypoint = fileURLToPath(
	new URL("./src/lib/cloudflare-access-auth.ts", import.meta.url),
);
const testAuthEntrypoint = fileURLToPath(
	new URL("./src/lib/test-auth.ts", import.meta.url),
);
const anonymousCloudflareCacheEntrypoint = fileURLToPath(
	new URL("./src/lib/anonymous-cloudflare-cache.ts", import.meta.url),
);
const cloudflareAccessInviteRouteEntrypoint = fileURLToPath(
	new URL("./src/emdash-routes/cloudflare-access-invite.ts", import.meta.url),
);
const useTestAuth = process.env.EMDASH_TEST_AUTH === "1";
const allowTestAuth = process.env.EMDASH_ALLOW_TEST_AUTH === "1";

if (useTestAuth && !allowTestAuth) {
	throw new Error(
		"EMDASH_TEST_AUTH requires EMDASH_ALLOW_TEST_AUTH=1 and must only be used by local e2e builds.",
	);
}

function localEmDashRoutes() {
	return {
		name: "engaged-philosophy-local-emdash-routes",
		hooks: {
			"astro:config:setup": ({ injectRoute }) => {
				injectRoute({
					pattern: "/_emdash/api/auth/invite",
					entrypoint: cloudflareAccessInviteRouteEntrypoint,
				});
			},
		},
	};
}

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	cache: {
		provider: {
			entrypoint: anonymousCloudflareCacheEntrypoint,
			config: {
				cacheName: ANONYMOUS_PAGE_CACHE_NAME,
			},
		},
	},
	vite: {
		css: {
			preprocessorOptions: {
				scss: {
					silenceDeprecations: [
						"import",
						"global-builtin",
						"color-functions",
						"if-function",
					],
				},
			},
		},
		build: {
			chunkSizeWarningLimit: 4096,
		},
	},
	integrations: [
		react(),
		localEmDashRoutes(),
		emdash({
			database: d1({ binding: "DB", session: "disabled" }),
			storage: r2({
				binding: "MEDIA",
				publicUrl: PUBLIC_MEDIA_URL,
			}),
			auth: useTestAuth
				? {
						type: "test",
						entrypoint: testAuthEntrypoint,
						config: {
							autoProvision: useTestAuth,
							defaultRole: 50,
						},
					}
				: {
						type: "cloudflare-access",
						entrypoint: cloudflareAccessAuthEntrypoint,
						config: {
							teamDomain: CLOUDFLARE_ACCESS_TEAM_DOMAIN,
							audienceEnvVar: "CF_ACCESS_AUDIENCE",
							autoProvision: false,
						},
					},
			plugins: [
				{
					id: "audit-log",
					version: "0.2.0",
					entrypoint: auditLogPluginEntrypoint,
				},
				{
					id: "embeds",
					version: "0.0.1",
					entrypoint: embedsPluginEntrypoint,
					componentsEntry: "@emdash-cms/plugin-embeds/astro",
					options: { types: ["youtube", "vimeo"] },
				},
				{
					id: "legacy-image-blocks",
					version: "0.1.0",
					entrypoint: legacyImagePluginEntrypoint,
					adminEntry: legacyImagePluginAdminEntrypoint,
				},
			],
		}),
	],
	devToolbar: { enabled: false },
});
