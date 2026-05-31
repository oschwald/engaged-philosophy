import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
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

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
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
		emdash({
			database: d1({ binding: "DB", session: "primary-first" }),
			storage: r2({ binding: "MEDIA" }),
			plugins: [
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
