import { describe, expect, test } from "vitest";

import {
	guessMimeTypeFromPath,
	internalMediaFileUrlForUpload,
	mediaValueForWordPressAttachment,
	uploadStorageKeyFromUrl,
	wordpressMediaId,
} from "../../../scripts/migration/lib/wordpress-media.mjs";

describe("WordPress media migration helpers", () => {
	test("normalizes WordPress attachment identifiers and URLs", () => {
		expect(wordpressMediaId("436")).toBe("wp-media-436");
		expect(
			uploadStorageKeyFromUrl(
				"https://media.engagedphilosophy.com/wp-content/uploads/2024/05/photo.jpg",
			),
		).toBe("wp-content/uploads/2024/05/photo.jpg");
		expect(
			internalMediaFileUrlForUpload(
				"https://www.engagedphilosophy.com/wp-content/uploads/2024/05/photo.jpg",
			),
		).toBe("/_emdash/api/media/file/wp-content/uploads/2024/05/photo.jpg");
	});

	test("guesses mime types used by migrated attachments", () => {
		expect(guessMimeTypeFromPath("clip.m4v")).toBe("video/mp4");
		expect(guessMimeTypeFromPath("image.webp")).toBe("image/webp");
	});

	test("creates local EmDash media values for WordPress attachments", () => {
		expect(
			mediaValueForWordPressAttachment("436", {
				url: "https://www.engagedphilosophy.com/wp-content/uploads/2013/02/AEC-1.jpg",
				alt: "AEC",
				filename: "AEC-1.jpg",
				width: 604,
				height: 453,
			}),
		).toEqual({
			provider: "local",
			id: "wp-media-436",
			filename: "AEC-1.jpg",
			mimeType: "image/jpeg",
			alt: "AEC",
			width: 604,
			height: 453,
			meta: {
				storageKey: "wp-content/uploads/2013/02/AEC-1.jpg",
			},
		});
	});
});
