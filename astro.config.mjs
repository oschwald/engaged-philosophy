import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { fileURLToPath } from "node:url";

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	vite: {
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
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
		}),
	],
	devToolbar: { enabled: false },
});
