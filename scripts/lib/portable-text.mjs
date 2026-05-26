import crypto from "node:crypto";

import { markdownToPortableText } from "emdash/client";
import TurndownService from "turndown";
import turndownPluginGfm from "turndown-plugin-gfm";

const { gfm } = turndownPluginGfm;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const LEGACY_SITE_HOST_RE = /^(?:www\.)?engagedphilosophy\.com$/i;
const TOKEN_RE = /(\[gallery[^\]]*\]|\[embed\][\s\S]*?\[\/embed\])/gi;

const turndown = new TurndownService({
	codeBlockStyle: "fenced",
	emDelimiter: "_",
	headingStyle: "atx",
});

turndown.use(gfm);
turndown.remove(["script", "style"]);
turndown.addRule("lineBreak", {
	filter: "br",
	replacement: () => "  \n",
});
turndown.addRule("divBlock", {
	filter: "div",
	replacement: (content) => `\n\n${content}\n\n`,
});

function generateKey() {
	return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function normalizeLegacyHref(value) {
	const normalized = (value || "").trim();
	if (!normalized) return "";
	if (normalized.startsWith("/wp-content/uploads/")) return normalized;
	if (normalized.startsWith("/")) return normalized;

	try {
		const url = new URL(normalized, "https://www.engagedphilosophy.com");
		if (!LEGACY_SITE_HOST_RE.test(url.hostname)) return normalized;
		if (url.pathname.startsWith("/wp-content/uploads/")) {
			return `${url.pathname}${url.search}${url.hash}`;
		}
		return `${url.pathname}${url.search}${url.hash}` || "/";
	} catch {
		return normalized;
	}
}

function normalizePortableTextBlocks(blocks) {
	return blocks.map((block) => {
		const nextBlock = structuredClone(block);

		if (Array.isArray(nextBlock.markDefs)) {
			nextBlock.markDefs = nextBlock.markDefs.map((markDef) =>
				markDef?._type === "link" && typeof markDef.href === "string"
					? { ...markDef, href: normalizeLegacyHref(markDef.href) }
					: markDef,
			);
		}

		if (
			nextBlock._type === "image" &&
			nextBlock.asset &&
			typeof nextBlock.asset.url === "string"
		) {
			nextBlock.asset = {
				...nextBlock.asset,
				_ref: nextBlock.asset._ref || generateKey(),
				url: normalizeLegacyHref(nextBlock.asset.url),
			};
		}

		if (nextBlock._type === "gallery" && Array.isArray(nextBlock.images)) {
			nextBlock.images = nextBlock.images.map((image) => ({
				...image,
				asset: {
					...image.asset,
					_ref: image.asset?._ref || generateKey(),
					url:
						typeof image.asset?.url === "string"
							? normalizeLegacyHref(image.asset.url)
							: image.asset?.url,
				},
			}));
		}

		return nextBlock;
	});
}

function htmlFragmentToPortableText(html) {
	const normalizedHtml = (html || "")
		.replace(CONTROL_CHARS, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.trim();
	if (!normalizedHtml) return [];

	const markdown = turndown.turndown(normalizedHtml).trim();
	if (!markdown) return [];

	return normalizePortableTextBlocks(markdownToPortableText(markdown));
}

function galleryShortcodeToPortableText(shortcode, mediaById) {
	const idsMatch = shortcode.match(/ids="([^"]+)"/i);
	if (!idsMatch) return [];

	const images = idsMatch[1]
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean)
		.map((id) => ({ id, media: mediaById[id] }))
		.filter((item) => item.media?.url)
		.map(({ id, media }) => ({
			_type: "image",
			_key: generateKey(),
			asset: {
				_ref: id,
				url: normalizeLegacyHref(media.url),
			},
			alt: media.alt || media.title || "",
			caption: media.title || "",
		}));

	if (images.length === 0) return [];

	return [
		{
			_type: "gallery",
			_key: generateKey(),
			columns: 3,
			images,
		},
	];
}

function embedShortcodeToPortableText(shortcode) {
	const url = shortcode
		.replace(/^\[embed\]/i, "")
		.replace(/\[\/embed\]$/i, "")
		.trim();

	if (!url) return [];
	return normalizePortableTextBlocks(
		markdownToPortableText(`[${url}](${url})`),
	);
}

export function htmlToPortableText(html, mediaById = {}) {
	const source = (html || "").trim();
	if (!source) return [];

	const blocks = [];
	let lastIndex = 0;

	for (const match of source.matchAll(TOKEN_RE)) {
		const [token] = match;
		const index = match.index ?? 0;

		if (index > lastIndex) {
			blocks.push(
				...htmlFragmentToPortableText(source.slice(lastIndex, index)),
			);
		}

		if (/^\[gallery/i.test(token)) {
			blocks.push(...galleryShortcodeToPortableText(token, mediaById));
		} else if (/^\[embed\]/i.test(token)) {
			blocks.push(...embedShortcodeToPortableText(token));
		}

		lastIndex = index + token.length;
	}

	if (lastIndex < source.length) {
		blocks.push(...htmlFragmentToPortableText(source.slice(lastIndex)));
	}

	return blocks;
}

export function isPortableTextJson(value) {
	if (typeof value !== "string") return false;

	try {
		const parsed = JSON.parse(value);
		return (
			Array.isArray(parsed) &&
			parsed.every(
				(item) =>
					item && typeof item === "object" && typeof item._type === "string",
			)
		);
	} catch {
		return false;
	}
}
