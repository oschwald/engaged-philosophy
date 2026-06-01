import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import auditLogPlugin from "@emdash-cms/plugin-audit-log";
import { embedsPlugin } from "@emdash-cms/plugin-embeds";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { fileURLToPath } from "node:url";
import { createLogger } from "vite";

const legacyImagePluginEntrypoint = fileURLToPath(
	new URL("./src/plugins/legacy-image-blocks.ts", import.meta.url),
);
const legacyImagePluginAdminEntrypoint = fileURLToPath(
	new URL("./src/plugins/legacy-image-blocks-admin.ts", import.meta.url),
);
const cloudflareAccessAuthEntrypoint = fileURLToPath(
	new URL("./src/lib/cloudflare-access-auth.ts", import.meta.url),
);
const anonymousCloudflareCacheEntrypoint = fileURLToPath(
	new URL("./src/lib/anonymous-cloudflare-cache.ts", import.meta.url),
);
const cloudflareAccessInviteRouteEntrypoint = fileURLToPath(
	new URL("./src/emdash-routes/cloudflare-access-invite.ts", import.meta.url),
);

function suppressKnownBuildWarnings(warning, warn) {
	if (
		warning.code === "UNUSED_EXTERNAL_IMPORT" &&
		warning.message.includes('"createRequire"') &&
		warning.message.includes("node_modules/emdash/dist/runner")
	) {
		return;
	}

	warn(warning);
}

const viteLogger = createLogger();
const viteWarn = viteLogger.warn;
viteLogger.warn = (message, options) => {
	if (
		typeof message === "string" &&
		message.includes("Default inspector port 9229 not available")
	) {
		return;
	}

	viteWarn(message, options);
};

function cloudflareAccessInviteRoute() {
	return {
		name: "engaged-philosophy-cloudflare-access-invite-route",
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
	experimental: {
		cache: {
			provider: {
				entrypoint: anonymousCloudflareCacheEntrypoint,
				config: {
					cacheName: "engaged-philosophy-pages-v2",
				},
			},
		},
	},
	vite: {
		customLogger: viteLogger,
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
			rollupOptions: {
				onwarn: suppressKnownBuildWarnings,
			},
		},
		resolve: {
			alias: {
				"@astrojs/internal-helpers/create-filter": fileURLToPath(
					new URL("./src/shims/astro-create-filter.ts", import.meta.url),
				),
			},
		},
		ssr: {
			noExternal: ["@astrojs/react", "@astrojs/internal-helpers", "picomatch"],
		},
	},
	integrations: [
		react(),
		cloudflareAccessInviteRoute(),
		emdash({
			database: d1({ binding: "DB", session: "disabled" }),
			storage: r2({
				binding: "MEDIA",
				publicUrl: "https://media.engagedphilosophy.com",
			}),
			auth: {
				type: "cloudflare-access",
				entrypoint: cloudflareAccessAuthEntrypoint,
				config: {
					teamDomain: "engaged-philosophy.cloudflareaccess.com",
					audienceEnvVar: "CF_ACCESS_AUDIENCE",
					autoProvision: false,
				},
			},
			plugins: [
				auditLogPlugin,
				embedsPlugin({ types: ["youtube", "vimeo"] }),
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
