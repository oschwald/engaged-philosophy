import crypto from "node:crypto";

import { markdownToPortableText } from "emdash/client";
import TurndownService from "turndown";
import turndownPluginGfm from "turndown-plugin-gfm";

const { gfm } = turndownPluginGfm;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const LEGACY_SITE_HOST_RE = /^(?:www\.)?engagedphilosophy\.com$/i;
const PUBLIC_MEDIA_URL = (
	process.env.PUBLIC_MEDIA_URL || "https://media.engagedphilosophy.com"
).replace(/\/+$/, "");
const TOKEN_RE =
	/(<figure\b[^>]*class=(?:"[^"]*\bwp-block-gallery\b[^"]*"|'[^']*\bwp-block-gallery\b[^']*')[\s\S]*?<\/ul>(?:\s*<figcaption\b[\s\S]*?<\/figcaption>)?\s*<\/figure>|<ul\b[^>]*class=(?:"[^"]*\bwp-block-gallery\b[^"]*"|'[^']*\bwp-block-gallery\b[^']*')[\s\S]*?<\/ul>|<div\b[^>]*class=(?:"[^"]*\bwp-block-jetpack-tiled-gallery\b[^"]*"|'[^']*\bwp-block-jetpack-tiled-gallery\b[^']*')[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>|<div\b[^>]*class=(?:"[^"]*\bwp-block-image\b[^"]*"|'[^']*\bwp-block-image\b[^']*')[\s\S]*?<\/figure>\s*<\/div>|<figure\b[^>]*class=(?:"[^"]*\bwp-block-image\b[^"]*"|'[^']*\bwp-block-image\b[^']*')[\s\S]*?<\/figure>|<figure\b[^>]*class=(?:"[^"]*\btiled-gallery__item\b[^"]*"|'[^']*\btiled-gallery__item\b[^']*')[\s\S]*?<\/figure>|<a\b[^>]*>(?:\s*<img\b[\s\S]*?>\s*)+<\/a>|<img\b[\s\S]*?>|<hr\b[^>]*\/?>|\[gallery[^\]]*\]|\[embed\][\s\S]*?\[\/embed\]|\[caption[^\]]*\][\s\S]*?\[\/caption\])/gi;

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

const BLOCK_TAG_RE =
	/<\/?(?:address|article|aside|blockquote|details|div|dl|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|main|nav|ol|p|pre|section|table|thead|tbody|tr|td|th|ul|li)\b/gi;
const BLOCK_FRAGMENT_RE =
	/(<p\b[\s\S]*?<\/p>|<ul\b[\s\S]*?<\/ul>|<ol\b[\s\S]*?<\/ol>|<h[1-6]\b[\s\S]*?<\/h[1-6]>|<blockquote\b[\s\S]*?<\/blockquote>|<hr\b[^>]*\/?>)/gi;
const EM_LINK_START_TOKEN = "EMLINKSTART";
const EM_LINK_END_TOKEN = "EMLINKEND";

function generateKey() {
	return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function normalizeMarkdownEscapes(text) {
	return text
		.replace(/(\d+)\\\./g, "$1.")
		.replace(/\\([\\`*_{}\[\]()#+\-.!])/g, "$1");
}

function normalizeMarkdownLinks(markdown) {
	return markdown.replace(
		/\[([\s\S]*?)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g,
		(_, label, url) => `[${label.replace(/\s+/g, " ").trim()}](${url})`,
	);
}

function wrapEmphasizedMarkdownLinks(markdown) {
	return markdown.replace(
		/_((?:\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\)))_/g,
		`${EM_LINK_START_TOKEN}$1${EM_LINK_END_TOKEN}`,
	);
}

function stripAdminLinksHtml(html) {
	return html.replace(
		/<p\b[^>]*>\s*<a\b[^>]*href=(["'])https?:\/\/(?:www\.)?engagedphilosophy\.com\/wp-admin\/[^"']*\1[^>]*>[\s\S]*?<\/a>\s*<\/p>/gi,
		"",
	);
}

function normalizeLegacyHref(value) {
	const normalized = (value || "")
		.trim()
		.replace(/\s+(?:"[^"]*"|'[^']*')$/, "");
	if (!normalized) return "";
	const embeddedUploadMatch = normalized.match(
		/\/wp-content\/uploads\/[^"'()\s<>]+(?:\?[^"'()\s<>]*)?/i,
	);
	if (embeddedUploadMatch) return embeddedUploadMatch[0];
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

function rewriteUploadUrl(value) {
	const normalized = normalizeLegacyHref(value);
	if (!normalized.startsWith("/wp-content/uploads/")) {
		return normalized;
	}

	return `${PUBLIC_MEDIA_URL}${normalized}`;
}

function parseAttributes(source) {
	const attributes = {};
	const attributePattern =
		/([^\s=/>]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
	let match;

	while ((match = attributePattern.exec(source))) {
		const [, name, doubleQuoted, singleQuoted, bare] = match;
		attributes[name.toLowerCase()] = doubleQuoted ?? singleQuoted ?? bare ?? "";
	}

	return attributes;
}

function getTagAttributes(token, tagName) {
	const match = token.match(new RegExp(`<${tagName}\\b([^>]*)>`, "i"));
	return match ? parseAttributes(match[1]) : {};
}

function pickImageSource(attributes) {
	return (
		attributes["data-orig-file"] ||
		attributes["data-large-file"] ||
		attributes.src ||
		""
	);
}

function getImageAlignment(attributes) {
	const className = attributes.class || "";
	if (/\balignleft\b/i.test(className)) return "left";
	if (/\balignright\b/i.test(className)) return "right";
	if (/\baligncenter\b/i.test(className)) return "center";
	return undefined;
}

function normalizeImageHref(anchorHref, permalink, imageSrc) {
	if (permalink) {
		return normalizeLegacyHref(permalink);
	}

	const normalizedAnchor = normalizeLegacyHref(anchorHref);
	if (normalizedAnchor && normalizedAnchor !== anchorHref) {
		return normalizedAnchor;
	}

	const normalizedSource = normalizeLegacyHref(imageSrc);
	if (normalizedSource.startsWith("/") || normalizedSource.startsWith("http")) {
		return normalizedSource;
	}

	return "";
}

function normalizeCaptionCandidate(value) {
	return (value || "")
		.trim()
		.replace(/\.[a-z0-9]{2,5}$/i, "")
		.replace(/-\d+x\d+$/i, "")
		.replace(/\s+/g, " ");
}

function isMeaningfulCaption(value, imageUrl = "", alt = "") {
	const candidate = normalizeCaptionCandidate(value);
	if (!candidate) return false;

	const imageName = normalizeCaptionCandidate(
		imageUrl.split("/").pop()?.split("?")[0] || "",
	);
	const altName = normalizeCaptionCandidate(alt);

	return ![imageName, altName].some(
		(reference) =>
			reference && reference.toLowerCase() === candidate.toLowerCase(),
	);
}

function shouldIgnoreImageUrl(value) {
	if (!value) return true;

	try {
		const url = new URL(value, "https://www.engagedphilosophy.com");
		return (
			url.hostname === "mail.google.com" &&
			/(?:^|\/)cleardot\.gif$/i.test(url.pathname)
		);
	} catch {
		return false;
	}
}

function extractPortableTextPlainText(blocks) {
	return blocks
		.map((block) => {
			if (block?._type !== "block" || !Array.isArray(block.children)) return "";
			return block.children
				.map((child) => (typeof child.text === "string" ? child.text : ""))
				.join("");
		})
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
}

function createTextBlock(text) {
	return {
		_type: "block",
		_key: generateKey(),
		style: "normal",
		markDefs: [],
		children: [
			{
				_type: "span",
				_key: generateKey(),
				text,
				marks: [],
			},
		],
	};
}

function unwrapWrappedMarks(block) {
	if (block?._type !== "block" || !Array.isArray(block.children)) return block;

	const textChildren = block.children.filter(
		(child) => child?._type === "span" && typeof child.text === "string",
	);
	if (!textChildren.length) return block;

	const plainText = textChildren.map((child) => child.text).join("");
	if (/^\*\*[\s\S]+\*\*$/.test(plainText)) {
		const first = textChildren.find((child) => child.text.length > 0);
		const last = [...textChildren]
			.reverse()
			.find((child) => child.text.length > 0);
		if (first) {
			first.text = first.text.replace(/^\*\*/, "");
		}
		if (last) {
			last.text = last.text.replace(/\*\*$/, "");
		}
		for (const child of textChildren) {
			child.marks = [...new Set([...(child.marks ?? []), "strong"])];
		}
	}

	for (const child of textChildren) {
		child.text = normalizeMarkdownEscapes(child.text);
	}

	block.children = block.children.filter(
		(child) =>
			child?._type !== "span" ||
			child.text !== "" ||
			(Array.isArray(child.marks) && child.marks.length > 0),
	);

	return block;
}

function applyEmphasizedLinkTokens(block) {
	if (block?._type !== "block" || !Array.isArray(block.children)) return block;

	let inEmphasizedLink = false;
	for (const child of block.children) {
		if (child?._type !== "span" || typeof child.text !== "string") continue;

		const hasStart = child.text.includes(EM_LINK_START_TOKEN);
		const hasEnd = child.text.includes(EM_LINK_END_TOKEN);
		const cleanedText = child.text
			.replaceAll(EM_LINK_START_TOKEN, "")
			.replaceAll(EM_LINK_END_TOKEN, "");

		if (hasStart) inEmphasizedLink = true;
		child.text = cleanedText;
		if (inEmphasizedLink && cleanedText) {
			child.marks = [...new Set([...(child.marks ?? []), "em"])];
		}
		if (hasEnd) inEmphasizedLink = false;
	}

	block.children = block.children.filter(
		(child) =>
			child?._type !== "span" ||
			child.text !== "" ||
			(Array.isArray(child.marks) && child.marks.length > 0),
	);

	return block;
}

function normalizeLegacyAlignment(align) {
	return align === "left" || align === "right" || align === "center"
		? align
		: undefined;
}

function createLegacyImageBlock({
	key,
	url,
	alt,
	caption,
	href,
	align,
	width,
	height,
	displayWidth,
	displayHeight,
}) {
	return {
		_type: "legacyImage",
		_key: key || generateKey(),
		url: rewriteUploadUrl(url),
		...(typeof alt === "string" && alt ? { alt } : {}),
		...(typeof caption === "string" && caption.trim()
			? { caption: caption.trim() }
			: {}),
		...(typeof href === "string" && href
			? { href: rewriteUploadUrl(href) }
			: {}),
		...(normalizeLegacyAlignment(align)
			? { align: normalizeLegacyAlignment(align) }
			: {}),
		...(typeof width === "number" ? { width } : {}),
		...(typeof height === "number" ? { height } : {}),
		...(typeof displayWidth === "number" ? { displayWidth } : {}),
		...(typeof displayHeight === "number" ? { displayHeight } : {}),
	};
}

function normalizeLegacyImageBlock(block) {
	const sourceUrl =
		typeof block?.url === "string"
			? block.url
			: typeof block?.asset?.url === "string"
				? block.asset.url
				: "";
	if (!sourceUrl || shouldIgnoreImageUrl(sourceUrl)) {
		return null;
	}

	return createLegacyImageBlock({
		key: block._key,
		url: sourceUrl,
		alt: typeof block.alt === "string" ? block.alt : "",
		caption: typeof block.caption === "string" ? block.caption : "",
		href: typeof block.href === "string" ? block.href : "",
		align: typeof block.align === "string" ? block.align : undefined,
		width: typeof block.width === "number" ? block.width : undefined,
		height: typeof block.height === "number" ? block.height : undefined,
		displayWidth:
			typeof block.displayWidth === "number" ? block.displayWidth : undefined,
		displayHeight:
			typeof block.displayHeight === "number" ? block.displayHeight : undefined,
	});
}

function normalizeImageBlock(block) {
	if (!block?.asset || typeof block.asset.url !== "string") {
		return null;
	}
	if (shouldIgnoreImageUrl(block.asset.url)) {
		return null;
	}
	if (typeof block.href === "string" || typeof block.align === "string") {
		return createLegacyImageBlock({
			key: block._key,
			url: block.asset.url,
			alt: typeof block.alt === "string" ? block.alt : "",
			caption: typeof block.caption === "string" ? block.caption : "",
			href: typeof block.href === "string" ? block.href : "",
			align: typeof block.align === "string" ? block.align : undefined,
			width: typeof block.width === "number" ? block.width : undefined,
			height: typeof block.height === "number" ? block.height : undefined,
			displayWidth:
				typeof block.displayWidth === "number" ? block.displayWidth : undefined,
			displayHeight:
				typeof block.displayHeight === "number"
					? block.displayHeight
					: undefined,
		});
	}

	return {
		_type: "image",
		_key: block._key || generateKey(),
		asset: {
			...block.asset,
			_ref: block.asset._ref || generateKey(),
			url: rewriteUploadUrl(block.asset.url),
		},
		...(typeof block.alt === "string" ? { alt: block.alt } : {}),
		...(typeof block.caption === "string" && block.caption.trim()
			? { caption: block.caption.trim() }
			: {}),
		...(typeof block.href === "string"
			? { href: rewriteUploadUrl(block.href) }
			: {}),
		...(typeof block.align === "string" ? { align: block.align } : {}),
		...(typeof block.width === "number" ? { width: block.width } : {}),
		...(typeof block.height === "number" ? { height: block.height } : {}),
		...(typeof block.displayWidth === "number"
			? { displayWidth: block.displayWidth }
			: {}),
		...(typeof block.displayHeight === "number"
			? { displayHeight: block.displayHeight }
			: {}),
	};
}

function normalizePortableTextBlocks(blocks) {
	const normalizedBlocks = [];

	for (const block of blocks) {
		const nextBlock = structuredClone(block);

		if (Array.isArray(nextBlock.markDefs)) {
			nextBlock.markDefs = nextBlock.markDefs.map((markDef) =>
				markDef?._type === "link" && typeof markDef.href === "string"
					? { ...markDef, href: rewriteUploadUrl(markDef.href) }
					: markDef,
			);
		}

		if (nextBlock._type === "image") {
			const normalizedImage = normalizeImageBlock(nextBlock);
			if (normalizedImage) {
				normalizedBlocks.push(normalizedImage);
			}
			continue;
		}

		if (nextBlock._type === "legacyImage") {
			const normalizedImage = normalizeLegacyImageBlock(nextBlock);
			if (normalizedImage) {
				normalizedBlocks.push(normalizedImage);
			}
			continue;
		}

		if (nextBlock._type === "gallery" && Array.isArray(nextBlock.images)) {
			const images = nextBlock.images
				.map((image) => {
					if (image?._type === "legacyImage") {
						return normalizeLegacyImageBlock(image);
					}
					return normalizeImageBlock(image);
				})
				.filter(Boolean);
			if (images.length > 0) {
				nextBlock.images = images;
				normalizedBlocks.push(nextBlock);
			}
			if (typeof nextBlock.caption === "string" && nextBlock.caption.trim()) {
				normalizedBlocks.push(createTextBlock(nextBlock.caption.trim()));
			}
			continue;
		}

		if (nextBlock._type === "horizontalRule") {
			normalizedBlocks.push({
				_type: "break",
				_key: nextBlock._key || generateKey(),
				style: "lineBreak",
			});
			continue;
		}

		if (
			nextBlock._type === "block" &&
			nextBlock.listItem === "bullet" &&
			Array.isArray(nextBlock.children)
		) {
			const text = nextBlock.children
				.map((child) => (typeof child.text === "string" ? child.text : ""))
				.join("")
				.trim();
			if (/^\*\s*\*$/.test(text) || /^\*\s*\*\s*\*$/.test(text)) {
				normalizedBlocks.push({
					_type: "break",
					_key: nextBlock._key || generateKey(),
					style: "lineBreak",
				});
				continue;
			}
		}

		if (
			nextBlock._type === "block" &&
			typeof nextBlock.listItem === "string" &&
			Array.isArray(nextBlock.children)
		) {
			const plainText = nextBlock.children
				.map((child) => (typeof child.text === "string" ? child.text : ""))
				.join("")
				.trim();
			const headingMatch = plainText.match(/^(#{1,6})\s+(.+)$/);
			if (headingMatch) {
				const [, hashes, headingText] = headingMatch;
				const firstTextChildIndex = nextBlock.children.findIndex(
					(child) => child?._type === "span" && typeof child.text === "string",
				);
				const normalizedChildren = nextBlock.children.map((child, index) =>
					index === firstTextChildIndex && child?._type === "span"
						? {
								...child,
								text: child.text.replace(/^(#{1,6})\s+/, ""),
							}
						: child,
				);
				nextBlock.style = `h${hashes.length}`;
				nextBlock.children = normalizedChildren;
			}
		}

		if (
			nextBlock._type === "block" &&
			Array.isArray(nextBlock.children) &&
			Array.isArray(nextBlock.markDefs)
		) {
			const normalizedChildren = [];
			const nextMarkDefs = [...nextBlock.markDefs];

			for (const child of nextBlock.children) {
				if (child?._type !== "span" || typeof child.text !== "string") {
					normalizedChildren.push(child);
					continue;
				}
				const text = child.text;
				const inheritedMarks = Array.isArray(child.marks) ? child.marks : [];
				const hasInlineMarkdown =
					/\[[^\]]+\]\((?:https?:\/\/|\/)/.test(text) ||
					/\*\*[^*]+\*\*/.test(text) ||
					/(^|[^\w])_[^_]+_(?!\w)/.test(text);

				if (!hasInlineMarkdown) {
					normalizedChildren.push({
						...child,
						text: normalizeMarkdownEscapes(text),
						marks: [...new Set(inheritedMarks)],
					});
					continue;
				}

				const parsed = markdownToPortableText(text);
				if (
					parsed.length !== 1 ||
					parsed[0]?._type !== "block" ||
					!Array.isArray(parsed[0].children)
				) {
					normalizedChildren.push({
						...child,
						marks: [...new Set(inheritedMarks)],
					});
					continue;
				}

				const markKeyMap = new Map();
				for (const markDef of parsed[0].markDefs ?? []) {
					const nextKey = generateKey();
					markKeyMap.set(markDef._key, nextKey);
					nextMarkDefs.push({
						...markDef,
						_key: nextKey,
						...(markDef?._type === "link" && typeof markDef.href === "string"
							? { href: rewriteUploadUrl(markDef.href) }
							: {}),
					});
				}

				for (const parsedChild of parsed[0].children) {
					let parsedText = parsedChild.text;
					const parsedMarks = [...(parsedChild.marks ?? [])];

					const parsedStrongMatch =
						typeof parsedText === "string"
							? parsedText.match(/^\*\*([\s\S]+)\*\*$/)
							: null;
					if (parsedStrongMatch) {
						parsedText = parsedStrongMatch[1];
						parsedMarks.push("strong");
					}

					const parsedEmMatch =
						typeof parsedText === "string"
							? parsedText.match(/^_([\s\S]+)_$/)
							: null;
					if (parsedEmMatch) {
						parsedText = parsedEmMatch[1];
						parsedMarks.push("em");
					}

					normalizedChildren.push({
						...parsedChild,
						_key: generateKey(),
						text:
							typeof parsedText === "string"
								? normalizeMarkdownEscapes(parsedText)
								: parsedText,
						marks: [
							...new Set([
								...inheritedMarks,
								...parsedMarks.map((mark) => markKeyMap.get(mark) ?? mark),
							]),
						],
					});
				}
			}

			nextBlock.children = normalizedChildren;
			nextBlock.markDefs = nextMarkDefs;
			applyEmphasizedLinkTokens(nextBlock);
			unwrapWrappedMarks(nextBlock);
		}

		normalizedBlocks.push(nextBlock);
	}

	return normalizedBlocks;
}

function autoWrapParagraphLikeHtml(html) {
	const normalized = (html || "").replace(/\r\n?/g, "\n").trim();
	if (!normalized || /<p[\s>]/i.test(normalized)) return normalized;

	const separated = normalized.replace(BLOCK_TAG_RE, (match) => `\n${match}\n`);
	const chunks = separated
		.split(/\n{2,}/)
		.map((chunk) => chunk.trim())
		.filter(Boolean);

	return chunks
		.map((chunk) =>
			/^<\/?(?:address|article|aside|blockquote|details|div|dl|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|main|nav|ol|p|pre|section|table|thead|tbody|tr|td|th|ul|li)\b/i.test(
				chunk,
			)
				? chunk
				: `<p>${chunk.replace(/\n/g, " ")}</p>`,
		)
		.join("\n\n");
}

function markdownFragmentToPortableText(html) {
	const markdown = wrapEmphasizedMarkdownLinks(
		normalizeMarkdownLinks(turndown.turndown(stripAdminLinksHtml(html)).trim()),
	);
	if (!markdown) return [];
	return normalizePortableTextBlocks(markdownToPortableText(markdown));
}

function htmlToPlainText(html) {
	return extractPortableTextPlainText(
		markdownFragmentToPortableText(html || ""),
	);
}

function htmlFragmentToPortableText(html) {
	const normalizedHtml = autoWrapParagraphLikeHtml(
		(html || "")
			.replace(CONTROL_CHARS, "")
			.replace(/<!--[\s\S]*?-->/g, "")
			.trim(),
	);
	if (!normalizedHtml) return [];

	const fragments = [];
	let lastIndex = 0;
	let sawBlockFragment = false;

	for (const match of normalizedHtml.matchAll(BLOCK_FRAGMENT_RE)) {
		sawBlockFragment = true;
		const [fragment] = match;
		const index = match.index ?? 0;
		if (index > lastIndex) {
			fragments.push(
				...markdownFragmentToPortableText(
					normalizedHtml.slice(lastIndex, index),
				),
			);
		}
		fragments.push(...markdownFragmentToPortableText(fragment));
		lastIndex = index + fragment.length;
	}

	if (sawBlockFragment) {
		if (lastIndex < normalizedHtml.length) {
			fragments.push(
				...markdownFragmentToPortableText(normalizedHtml.slice(lastIndex)),
			);
		}
		return fragments;
	}

	return markdownFragmentToPortableText(normalizedHtml);
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
				url: rewriteUploadUrl(media.url),
			},
			alt: media.alt || media.title || "",
			...(isMeaningfulCaption(
				media.caption || media.title || "",
				media.url,
				media.alt,
			)
				? { caption: media.caption || media.title || "" }
				: {}),
		}));

	if (images.length === 0) return [];

	return [
		{
			_type: "gallery",
			_key: generateKey(),
			layout: "shortcode",
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

function getCaptionAlignment(alignAttr) {
	if (!alignAttr) return undefined;
	if (/\balignleft\b|left/i.test(alignAttr)) return "left";
	if (/\balignright\b|right/i.test(alignAttr)) return "right";
	if (/\baligncenter\b|center/i.test(alignAttr)) return "center";
	return undefined;
}

function captionShortcodeToPortableText(token) {
	const match = token.match(/^\[caption\s+([^\]]+)\]([\s\S]*?)\[\/caption\]$/i);
	if (!match) return [];

	const captionAttributes = parseAttributes(match[1]);
	const innerContent = match[2];

	const contentMatch = innerContent.match(
		/^(\s*(?:<a\b[^>]*>\s*)?<img\b[^>]*>(?:\s*<\/a>)?)([\s\S]*)$/i,
	);
	if (!contentMatch) return [];

	const imageHtml = contentMatch[1];
	const captionText = htmlToPlainText(contentMatch[2]);

	const align = getCaptionAlignment(captionAttributes.align);

	return imageHtmlToPortableText(imageHtml, {
		align,
		...(captionText ? { caption: captionText } : {}),
	});
}

function imageAttributesToPortableText(
	imageAttributes,
	anchorAttributes = {},
	overrides = {},
) {
	const imageSrc = normalizeLegacyHref(pickImageSource(imageAttributes));
	if (!imageSrc) return null;

	const href = normalizeImageHref(
		anchorAttributes.href || "",
		imageAttributes["data-permalink"] || "",
		imageSrc,
	);
	const align =
		overrides.align || getImageAlignment(imageAttributes) || undefined;
	const width =
		Number(
			imageAttributes.width ||
				imageAttributes["data-width"] ||
				imageAttributes["data-original-width"] ||
				"0",
		) || undefined;
	const height =
		Number(
			imageAttributes.height ||
				imageAttributes["data-height"] ||
				imageAttributes["data-original-height"] ||
				"0",
		) || undefined;

	return {
		...(href || align
			? createLegacyImageBlock({
					url: imageSrc,
					alt: imageAttributes.alt || imageAttributes["data-image-title"] || "",
					href,
					align,
					caption: overrides.caption,
					width,
					height,
				})
			: {
					_type: "image",
					_key: generateKey(),
					asset: {
						_ref: generateKey(),
						url: rewriteUploadUrl(imageSrc),
					},
					alt: imageAttributes.alt || imageAttributes["data-image-title"] || "",
					...(overrides.caption ? { caption: overrides.caption } : {}),
					...(width ? { width } : {}),
					...(height ? { height } : {}),
				}),
	};
}

function imageHtmlToPortableText(token, overrides = {}) {
	const anchorMatch = token.match(/^<a\b([^>]*)>([\s\S]*?)<\/a>$/i);
	const anchorAttributes = anchorMatch ? parseAttributes(anchorMatch[1]) : {};
	const imageSource = anchorMatch ? anchorMatch[2] : token;
	const images = [];

	for (const imageMatch of imageSource.matchAll(/<img\b([^>]*)>/gi)) {
		const imageAttributes = parseAttributes(imageMatch[1]);
		const image = imageAttributesToPortableText(
			imageAttributes,
			anchorAttributes,
			overrides,
		);
		if (image) images.push(image);
	}

	return images;
}

function galleryFigureToPortableText(token) {
	const tagName = token.trim().startsWith("<ul") ? "ul" : "figure";
	const galleryAttributes = getTagAttributes(token, tagName);
	const className = galleryAttributes.class || "";
	const columns =
		Number(className.match(/\bcolumns-(\d+)\b/i)?.[1] || "0") || undefined;
	const align = /\baligncenter\b/i.test(className) ? "center" : undefined;
	const images = [];

	for (const itemMatch of token.matchAll(
		/<li\b[^>]*class=(?:"[^"]*\bblocks-gallery-item\b[^"]*"|'[^']*\bblocks-gallery-item\b[^']*')[^>]*>([\s\S]*?)<\/li>/gi,
	)) {
		const itemHtml = itemMatch[1];
		const caption = htmlToPlainText(
			itemHtml.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] || "",
		);
		images.push(...imageHtmlToPortableText(itemHtml, { caption }));
	}

	if (images.length === 0) return [];

	const caption = htmlToPlainText(
		token.match(
			/<figcaption\b[^>]*class=(?:"[^"]*\bblocks-gallery-caption\b[^"]*"|'[^']*\bblocks-gallery-caption\b[^']*')[^>]*>([\s\S]*?)<\/figcaption>/i,
		)?.[1] || "",
	);

	return [
		{
			_type: "gallery",
			_key: generateKey(),
			layout: "figure",
			images,
			...(columns ? { columns } : {}),
			...(align ? { align } : {}),
			...(caption ? { caption } : {}),
		},
	];
}

function imageFigureToPortableText(token) {
	const figureMatch =
		token.match(/<figure\b([^>]*)>([\s\S]*?)<\/figure>/i) ||
		token.match(/^<figure\b([^>]*)>([\s\S]*?)<\/figure>$/i);
	if (!figureMatch) return [];

	const figureAttributes = parseAttributes(figureMatch[1]);
	const caption = htmlToPlainText(
		figureMatch[2].match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ||
			"",
	);
	const align = getImageAlignment(figureAttributes);
	return imageHtmlToPortableText(figureMatch[2], { align, caption });
}

function horizontalRuleToPortableText() {
	return [
		{
			_type: "break",
			_key: generateKey(),
			style: "lineBreak",
		},
	];
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

		if (/\bwp-block-gallery\b/i.test(token)) {
			blocks.push(...galleryFigureToPortableText(token));
		} else if (/\bwp-block-jetpack-tiled-gallery\b/i.test(token)) {
			blocks.push(...imageHtmlToPortableText(token, { align: "center" }));
		} else if (/\bwp-block-image\b/i.test(token)) {
			blocks.push(...imageFigureToPortableText(token));
		} else if (/^<a\b/i.test(token) || /^<img\b/i.test(token)) {
			blocks.push(...imageHtmlToPortableText(token));
		} else if (/^<hr\b/i.test(token)) {
			blocks.push(...horizontalRuleToPortableText());
		} else if (/^\[gallery/i.test(token)) {
			blocks.push(...galleryShortcodeToPortableText(token, mediaById));
		} else if (/^\[embed\]/i.test(token)) {
			blocks.push(...embedShortcodeToPortableText(token));
		} else if (/^\[caption/i.test(token)) {
			blocks.push(...captionShortcodeToPortableText(token));
		}

		lastIndex = index + token.length;
	}

	if (lastIndex < source.length) {
		blocks.push(...htmlFragmentToPortableText(source.slice(lastIndex)));
	}

	return normalizePortableTextBlocks(blocks);
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
