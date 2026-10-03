import { createStorage as createR2Storage } from "@emdash-cms/cloudflare/storage/r2";
import { getMediaUrlPrefix, PUBLIC_MEDIA_URL } from "./media";

// Native R2 serves preview media through the same-origin EmDash file endpoint.
export function createStorage(config: Record<string, unknown>) {
	return createR2Storage({
		binding: config.binding,
		...(getMediaUrlPrefix() === PUBLIC_MEDIA_URL
			? { publicUrl: PUBLIC_MEDIA_URL }
			: {}),
	});
}
