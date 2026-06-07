import { parseSeedPathArg, readSeedFile } from "./lib/migration-seed-path.mjs";
import {
	EMDASH_MEDIA_FILE_PREFIX,
	uploadStorageKeyFromUrl,
	WORDPRESS_MEDIA_ID_PREFIX,
} from "./lib/wordpress-media.mjs";

const args = process.argv.slice(2);
const seedPath = parseSeedPathArg(args);
const seed = readSeedFile(seedPath);
const RAW_UPLOAD_URL_RE =
	/https?:\/\/(?:www\.|media\.)?engagedphilosophy\.com\/wp-content\/uploads\/[^"'()\s<>]+/gi;

const summary = {
	seedMedia: 0,
	seedMediaWithStorageKeys: 0,
	seedMediaWithMimeTypes: 0,
	seedMediaWithCreatedAt: 0,
	legacyImages: 0,
	legacyVideos: 0,
	standardImages: 0,
	featuredImages: 0,
	rawUploadUrls: 0,
	issues: [],
};

function pushIssue(message, sample) {
	summary.issues.push({ message, sample });
}

function isInternalMediaUrl(value) {
	return (
		typeof value === "string" && value.startsWith(EMDASH_MEDIA_FILE_PREFIX)
	);
}

function isUploadBacked(value) {
	return typeof value === "string" && Boolean(uploadStorageKeyFromUrl(value));
}

function inspectMediaValue(value, path) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return;
	if (
		value.provider !== "local" &&
		!value.$media &&
		typeof value.src !== "string"
	) {
		return;
	}

	summary.featuredImages += 1;

	if (value.$media) {
		pushIssue("featured_image still uses seed-only $media syntax", {
			path,
			value,
		});
		return;
	}

	if (!String(value.id || "").startsWith(WORDPRESS_MEDIA_ID_PREFIX)) {
		pushIssue("featured_image does not reference imported WordPress media", {
			path,
			id: value.id,
		});
	}

	if (!value.meta?.storageKey) {
		pushIssue("featured_image is missing a local storage key", {
			path,
			id: value.id,
		});
	}
}

function inspectPortableTextNode(node, path) {
	if (!node || typeof node !== "object" || Array.isArray(node)) return;

	if (node._type === "legacyImage") {
		summary.legacyImages += 1;
		const source = node.id || node.url || node.asset?.url || "";
		if (isUploadBacked(source) && !isInternalMediaUrl(source)) {
			pushIssue("legacyImage source is not an EmDash media file URL", {
				path,
				source,
			});
		}
		if (node.url && isUploadBacked(node.url)) {
			pushIssue("legacyImage stores an upload source in url instead of id", {
				path,
				url: node.url,
			});
		}
		if (isUploadBacked(node.href) && !isInternalMediaUrl(node.href)) {
			pushIssue("legacyImage href is not an EmDash media file URL", {
				path,
				href: node.href,
			});
		}
	}

	if (node._type === "legacyVideo") {
		summary.legacyVideos += 1;
		if (isUploadBacked(node.url) && !isInternalMediaUrl(node.url)) {
			pushIssue("legacyVideo URL is not an EmDash media file URL", {
				path,
				url: node.url,
			});
		}
	}

	if (node._type === "image") {
		summary.standardImages += 1;
		if (
			isUploadBacked(node.asset?.url) &&
			!isInternalMediaUrl(node.asset.url)
		) {
			pushIssue("image asset URL is not an EmDash media file URL", {
				path,
				url: node.asset.url,
			});
		}
		if (/^\d+$/.test(node.asset?._ref || "")) {
			pushIssue("image asset still uses a raw WordPress attachment id", {
				path,
				ref: node.asset._ref,
			});
		}
	}
}

function walk(value, path = []) {
	if (typeof value === "string") {
		const matches = [...value.matchAll(RAW_UPLOAD_URL_RE)];
		if (matches.length > 0) {
			summary.rawUploadUrls += matches.length;
			pushIssue("content contains a raw WordPress upload URL", {
				path: path.join("."),
				value,
			});
		}
		return;
	}

	if (Array.isArray(value)) {
		value.forEach((item, index) => walk(item, [...path, index]));
		return;
	}

	if (!value || typeof value !== "object") return;

	inspectPortableTextNode(value, path.join("."));
	if (path.at(-1) === "featured_image") {
		inspectMediaValue(value, path.join("."));
	}

	for (const [key, child] of Object.entries(value)) {
		walk(child, [...path, key]);
	}
}

for (const item of Object.values(seed.media ?? {})) {
	summary.seedMedia += 1;
	if (uploadStorageKeyFromUrl(item?.url || "")) {
		summary.seedMediaWithStorageKeys += 1;
	}
	if (item?.mimeType) {
		summary.seedMediaWithMimeTypes += 1;
	}
	if (item?.createdAt) {
		summary.seedMediaWithCreatedAt += 1;
	}
}

walk(seed.content ?? {}, ["content"]);

console.log(
	JSON.stringify(
		{
			seedPath,
			...summary,
			issues: summary.issues.slice(0, 20),
			issueCount: summary.issues.length,
		},
		null,
		2,
	),
);

if (
	summary.seedMedia === 0 ||
	summary.seedMedia !== summary.seedMediaWithStorageKeys ||
	summary.seedMedia !== summary.seedMediaWithMimeTypes ||
	summary.seedMedia !== summary.seedMediaWithCreatedAt ||
	summary.issues.length > 0
) {
	process.exit(1);
}
