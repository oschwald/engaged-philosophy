import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, kvCache, r2 } from "@emdash-cms/cloudflare";
import auditLogPlugin from "@emdash-cms/plugin-audit-log";
import { embedsPlugin } from "@emdash-cms/plugin-embeds";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { fileURLToPath } from "node:url";

import {
	CLOUDFLARE_ACCESS_TEAM_DOMAIN,
	PUBLIC_MEDIA_URL,
	PUBLIC_SITE_URL,
} from "./src/lib/site-config.ts";

const legacyContentPluginEntrypoint = fileURLToPath(
	new URL("./src/plugins/legacy-content-blocks.ts", import.meta.url),
);
const cloudflareAccessAuthEntrypoint = fileURLToPath(
	new URL("./src/lib/cloudflare-access-auth.ts", import.meta.url),
);
const testAuthEntrypoint = fileURLToPath(
	new URL("./src/lib/test-auth.ts", import.meta.url),
);
const cloudflareCacheProviderEntrypoint = fileURLToPath(
	new URL("./src/lib/cloudflare-cache-provider.ts", import.meta.url),
);
const cloudflareAccessInviteRouteEntrypoint = fileURLToPath(
	new URL("./src/emdash-routes/cloudflare-access-invite.ts", import.meta.url),
);
const useTestAuth = process.env.EMDASH_TEST_AUTH === "1";
const allowTestAuth = process.env.EMDASH_ALLOW_TEST_AUTH === "1";
const emdashTypesCheckState = process.env.EMDASH_TYPES_CHECK_STATE;

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

export const configuredAuditLogPlugin = {
	...auditLogPlugin,
	capabilities: ["content:read", "content:write", "media:read"],
};

export const emdashPlugins = [
	configuredAuditLogPlugin,
	embedsPlugin({ types: ["youtube", "vimeo"] }),
	{
		id: "legacy-image-blocks",
		version: "0.1.0",
		entrypoint: legacyContentPluginEntrypoint,
	},
];

export default defineConfig({
	site: PUBLIC_SITE_URL,
	output: "server",
	adapter: cloudflare({
		...(emdashTypesCheckState
			? { persistState: { path: emdashTypesCheckState } }
			: {}),
	}),
	cache: {
		provider: {
			name: "cloudflare",
			entrypoint: cloudflareCacheProviderEntrypoint,
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
			siteUrl: PUBLIC_SITE_URL,
			database: d1({ binding: "DB", session: "disabled" }),
			objectCache: kvCache({
				binding: "SESSION",
				keyPrefix: "ep:object-cache",
				defaultTtl: 86_400,
			}),
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
			plugins: emdashPlugins,
		}),
	],
	devToolbar: { enabled: false },
});
