import { describe, expect, test } from "vitest";

import {
	getPublicMediaStorageUrl,
	rewriteInternalMediaFileUrl,
} from "../../src/lib/media";

describe("media URL helpers", () => {
	test("builds public storage URLs", () => {
		expect(
			getPublicMediaStorageUrl(
				"wp-content/uploads/2024/05/photo name.jpg",
				"https://media.example/",
			),
		).toBe("https://media.example/wp-content/uploads/2024/05/photo%20name.jpg");
	});

	test("rewrites internal media file URLs and tolerates malformed encodings", () => {
		expect(
			rewriteInternalMediaFileUrl(
				"/_emdash/api/media/file/wp-content/uploads/2024/05/photo.jpg?download=1",
				"https://media.example",
			),
		).toBe("https://media.example/wp-content/uploads/2024/05/photo.jpg");
		expect(() =>
			rewriteInternalMediaFileUrl(
				"/_emdash/api/media/file/wp-content/uploads/%ZZ/photo.jpg",
				"https://media.example",
			),
		).not.toThrow();
		expect(
			rewriteInternalMediaFileUrl(
				"/_emdash/api/media/file/wp-content/uploads/%ZZ/photo.jpg",
				"https://media.example",
			),
		).toBe("https://media.example/wp-content/uploads/%25ZZ/photo.jpg");
	});
});
