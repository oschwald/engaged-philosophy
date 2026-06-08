import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

delete process.env.FORCE_COLOR;
delete process.env.NO_COLOR;

function resolveBrowserPath() {
	const candidates = [
		process.env.PLAYWRIGHT_BROWSER_PATH,
		process.env.RENDERED_SMOKE_BROWSER_PATH,
		"/usr/bin/google-chrome",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
	].filter((candidate): candidate is string => Boolean(candidate));

	return candidates.find((candidate) => existsSync(candidate));
}

const browserPath = resolveBrowserPath();

export default defineConfig({
	testDir: "./e2e-static/specs",
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	timeout: 30_000,
	expect: {
		timeout: 5000,
	},
	outputDir: "test-results/e2e-static",
	reporter: [
		["list"],
		["html", { outputFolder: "playwright-report-static", open: "never" }],
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
