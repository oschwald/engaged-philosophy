import assert from "node:assert/strict";

import {
	guessMimeTypeFromPath,
	internalMediaFileUrlForUpload,
	mediaValueForWordPressAttachment,
	uploadStorageKeyFromUrl,
	wordpressMediaId,
} from "./lib/wordpress-media.mjs";

assert.equal(wordpressMediaId("436"), "wp-media-436");

assert.equal(
	uploadStorageKeyFromUrl(
		"https://media.engagedphilosophy.com/wp-content/uploads/2024/05/photo.jpg",
	),
	"wp-content/uploads/2024/05/photo.jpg",
);

assert.equal(
	internalMediaFileUrlForUpload(
		"https://www.engagedphilosophy.com/wp-content/uploads/2024/05/photo.jpg",
	),
	"/_emdash/api/media/file/wp-content/uploads/2024/05/photo.jpg",
);

assert.equal(guessMimeTypeFromPath("clip.m4v"), "video/mp4");
assert.equal(guessMimeTypeFromPath("image.webp"), "image/webp");

assert.deepEqual(
	mediaValueForWordPressAttachment("436", {
		url: "https://www.engagedphilosophy.com/wp-content/uploads/2013/02/AEC-1.jpg",
		alt: "AEC",
		filename: "AEC-1.jpg",
		width: 604,
		height: 453,
	}),
	{
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
	},
);
