import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function expectExactHeading(
	page: Page,
	name: string,
	options: { level?: number; timeout?: number } = {},
) {
	const { level, timeout = 15_000 } = options;
	await expect(
		page.getByRole("heading", {
			name,
			exact: true,
			...(level === undefined ? {} : { level }),
		}),
	).toBeVisible({ timeout });
}

export async function expectOkJson(
	request: APIRequestContext,
	pathName: string,
) {
	const response = await request.get(pathName);
	const text = await response.text();

	expect(
		response.status(),
		`Expected ${pathName} to return 2xx\n${text}`,
	).toBeGreaterThanOrEqual(200);
	expect(
		response.status(),
		`Expected ${pathName} to return 2xx\n${text}`,
	).toBeLessThan(300);

	return text ? JSON.parse(text) : null;
}

export function collectPageErrors(
	page: Page,
	options: { ignore?: RegExp[] } = {},
) {
	const errors: string[] = [];

	page.on("console", (message) => {
		if (message.type() === "error") {
			const location = message.location();
			const locationText = location.url ? ` (${location.url})` : "";
			const text = `${message.text()}${locationText}`;
			if (options.ignore?.some((pattern) => pattern.test(text))) return;
			errors.push(text);
		}
	});
	page.on("pageerror", (error) => {
		errors.push(error.message);
	});

	return {
		expectNone() {
			expect(errors, `Page logged errors:\n${errors.join("\n")}`).toHaveLength(
				0,
			);
		},
	};
}
