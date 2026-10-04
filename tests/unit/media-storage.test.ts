import { afterEach, expect, test, vi } from "vitest";

import { env } from "../support/cloudflare-workers";
import { createStorage } from "../../src/lib/media-storage";

const workerEnv = env as Record<string, unknown>;
afterEach(() => {
	delete workerEnv.SITE_PREVIEW;
	delete workerEnv.MEDIA;
});

test("native preview uploads use the bound bucket and same-origin delivery", async () => {
	workerEnv.SITE_PREVIEW = "true";
	const put = vi.fn().mockResolvedValue({ size: 3 });
	workerEnv.MEDIA = { put };
	const storage = createStorage({ binding: "MEDIA" });
	const body = new Uint8Array([1, 2, 3]);
	expect(
		await storage.upload({
			key: "preview.png",
			body,
			contentType: "image/png",
		}),
	).toEqual({
		key: "preview.png",
		size: 3,
		url: "/_emdash/api/media/file/preview.png",
	});
	expect(put).toHaveBeenCalledWith("preview.png", body, {
		httpMetadata: { contentType: "image/png", cacheControl: undefined },
	});
});

test("production native storage uses the fixed media origin", () => {
	workerEnv.MEDIA = {};
	expect(
		createStorage({
			binding: "MEDIA",
			publicUrl: "https://other.invalid",
		}).getPublicUrl("image.png"),
	).toBe("https://media.engagedphilosophy.com/image.png");
});
