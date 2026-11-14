import { describe, expect, test } from "vitest";

import {
	getPublicMediaStorageUrl,
	getMediaUrlPrefix,
} from "../../src/lib/media";

describe("media URL helpers", () => {
	test("uses a fixed production origin and a narrow preview flag", () => {
		expect(getMediaUrlPrefix({ SITE_PREVIEW: "true" })).toBe(
			"/_emdash/api/media/file",
		);
		expect(getMediaUrlPrefix({ SITE_PREVIEW: "false" })).toBe(
			"https://media.engagedphilosophy.com",
		);
	});
	test("builds public storage URLs", () => {
		expect(
			getPublicMediaStorageUrl(
				"wp-content/uploads/2024/05/photo name.jpg",
				"https://media.example/",
			),
		).toBe("https://media.example/wp-content/uploads/2024/05/photo%20name.jpg");
	});
});
