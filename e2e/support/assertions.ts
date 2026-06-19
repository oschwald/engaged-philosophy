import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const LOCAL_MEDIA_THUMBNAIL_OPTIMIZER_403 =
	/status of 403 \(Forbidden\).*\/_image\?href=.*%2F_emdash%2Fapi%2Fmedia%2Ffile%2F/;

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
