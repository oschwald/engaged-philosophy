import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

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

export function collectPageErrors(page: Page) {
	const errors: string[] = [];

	page.on("console", (message) => {
		if (message.type() === "error") {
			errors.push(message.text());
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
