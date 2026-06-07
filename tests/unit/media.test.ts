import { describe, expect, test } from "vitest";

import {
	getAssetSrc,
	getPublicMediaStorageUrl,
	rewriteInternalMediaFileUrl,
	rewriteWordPressUploadUrl,
} from "../../src/lib/media";

describe("media URL helpers", () => {
	test("filters unsafe fallback media URLs", () => {
		expect(getAssetSrc(null, "javascript:alert(1)")).toBe("");
		expect(getAssetSrc(null, "data:image/svg+xml,<svg></svg>")).toBe("");
		expect(getAssetSrc(null, "#image")).toBe("");
	});

	test("preserves safe fallback media URLs", () => {
		expect(getAssetSrc(null, "/media/photo.jpg")).toBe("/media/photo.jpg");
		expect(getAssetSrc(null, "https://media.example/photo.jpg")).toBe(
			"https://media.example/photo.jpg",
		);
		expect(getAssetSrc(null, "http://media.example/photo.jpg")).toBe("");
	});

	test("rewrites WordPress upload URLs to the public media host", () => {
		expect(
			rewriteWordPressUploadUrl(
				"/wp-content/uploads/2024/05/photo.jpg",
				"https://media.engagedphilosophy.com",
			),
		).toBe(
			"https://media.engagedphilosophy.com/wp-content/uploads/2024/05/photo.jpg",
		);
		expect(
			getAssetSrc(
				null,
				"/wp-content/uploads/2024/05/photo.jpg",
				(key) => `https://media.engagedphilosophy.com/${key}`,
			),
		).toBe(
			"https://media.engagedphilosophy.com/wp-content/uploads/2024/05/photo.jpg",
		);
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

	test("falls back to public storage URL when resolver output is unsafe", () => {
		const key = "wp-content/uploads/2024/05/photo.jpg";

		expect(
			getAssetSrc(
				{ meta: { storageKey: key } },
				null,
				() => "javascript:alert(1)",
			),
		).toBe(getPublicMediaStorageUrl(key));
	});
});
