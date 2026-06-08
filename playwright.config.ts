import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

delete process.env.FORCE_COLOR;
delete process.env.NO_COLOR;

function resolveBrowserPath() {
	const candidates = [
		process.env.RENDERED_SMOKE_BROWSER_PATH,
		"/usr/bin/google-chrome",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
	].filter((candidate): candidate is string => Boolean(candidate));

	return candidates.find((candidate) => existsSync(candidate));
}

const browserPath = resolveBrowserPath();
const workers = Number.parseInt(process.env.E2E_WORKERS ?? "2", 10);

export default defineConfig({
	testDir: "./e2e/specs",
	globalSetup: "./e2e/global-setup.ts",
	fullyParallel: false,
	workers: Number.isFinite(workers) && workers > 0 ? workers : 2,
	retries: process.env.CI ? 1 : 0,
	timeout: 30_000,
	expect: {
		timeout: 7500,
	},
	outputDir: "test-results/e2e",
	reporter: [
		["list"],
		["html", { outputFolder: "playwright-report", open: "never" }],
	],
	use: {
		actionTimeout: 15_000,
		navigationTimeout: 15_000,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: process.env.PLAYWRIGHT_VIDEO === "1" ? "retain-on-failure" : "off",
	},
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				launchOptions: browserPath
					? {
							executablePath: browserPath,
						}
					: undefined,
			},
		},
	],
});
