import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

test.each(["../../playwright.config", "../../playwright.static.config"])(
	"%s defaults to Playwright Chromium and honors an explicit browser path",
	async (configPath) => {
		vi.stubEnv("PLAYWRIGHT_BROWSER_PATH", "");
		vi.stubEnv("RENDERED_SMOKE_BROWSER_PATH", "/old-browser");
		const { default: defaults } = await import(configPath);
		expect(defaults.projects[0].use.launchOptions).toBeUndefined();
		vi.resetModules();
		vi.stubEnv("PLAYWRIGHT_BROWSER_PATH", "/explicit-browser");
		const { default: override } = await import(configPath);
		expect(override.projects[0].use.launchOptions).toEqual({
			executablePath: "/explicit-browser",
		});
	},
);
