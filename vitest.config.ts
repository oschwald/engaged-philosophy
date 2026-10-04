import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
	resolve: {
		alias: {
			"@emdash-cms/cloudflare/storage/r2": fileURLToPath(
				new URL(
					"./node_modules/@emdash-cms/cloudflare/src/storage/r2.ts",
					import.meta.url,
				),
			),
			"cloudflare:workers": fileURLToPath(
				new URL("./tests/support/cloudflare-workers.ts", import.meta.url),
			),
		},
	},
	test: {
		include: ["tests/**/*.test.ts"],
		environment: "node",
		globals: false,
	},
});
