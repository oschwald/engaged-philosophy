import { extractPlainText, type PortableTextBlock } from "emdash";

type RichTextFieldValue = PortableTextBlock[] | null | undefined;

interface RichTextEntryData {
	content?: RichTextFieldValue;
	excerpt?: RichTextFieldValue;
}

function getRichTextValue(value: RichTextFieldValue) {
	return Array.isArray(value) ? value : undefined;
}

export function getEntryContent(data?: RichTextEntryData | null) {
	return getRichTextValue(data?.content);
}

export function getEntryExcerpt(data?: RichTextEntryData | null) {
	return getRichTextValue(data?.excerpt);
}

export function decodeHtmlEntities(value?: string | null) {
	const namedEntities: Record<string, string> = {
		amp: "&",
		apos: "'",
		quot: '"',
		nbsp: " ",
		hellip: "…",
		ndash: "–",
		mdash: "—",
		lsquo: "‘",
		rsquo: "’",
		ldquo: "“",
		rdquo: "”",
	};

	return (value ?? "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, token) => {
		const lowerToken = token.toLowerCase();
		if (lowerToken.startsWith("#x")) {
			const codePoint = Number.parseInt(lowerToken.slice(2), 16);
			return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
		}
		if (lowerToken.startsWith("#")) {
			const codePoint = Number.parseInt(lowerToken.slice(1), 10);
			return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
		}
		return namedEntities[lowerToken] ?? entity;
	});
}

function stripWordPressShortcodes(value: string) {
	return value.replace(/\[(?:\/)?[a-z][\w-]*(?:[^\]]*)\]/gi, " ");
}

function getImageAlt(block: PortableTextBlock) {
	return typeof block.alt === "string" ? block.alt : "";
}

function getGalleryImageText(block: PortableTextBlock) {
	if (!("images" in block) || !Array.isArray(block.images)) return "";

	return block.images
		.map((image: { alt?: unknown; caption?: unknown }) =>
			typeof image.alt === "string"
				? image.alt
				: typeof image.caption === "string"
					? image.caption
					: "",
		)
		.join(" ");
}

function portableTextToPlainText(value: PortableTextBlock[]) {
	return value
		.map((block) => {
			if (block._type === "image") return getImageAlt(block);
			if (block._type === "gallery") return getGalleryImageText(block);
			return extractPlainText([block]);
		})
		.join(" ");
}

export function isPortableTextValue(
	value?: string | PortableTextBlock[] | null,
): value is PortableTextBlock[] {
	return Array.isArray(value);
}

export function stripHtml(value?: string | PortableTextBlock[] | null) {
	if (isPortableTextValue(value)) {
		return stripWordPressShortcodes(portableTextToPlainText(value))
			.replace(/\s+/g, " ")
			.trim();
	}

	return stripWordPressShortcodes(decodeHtmlEntities(value))
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function getExcerptText(
	excerpt?: string | PortableTextBlock[] | null,
	content?: string | PortableTextBlock[] | null,
	wordLimit = 55,
) {
	const preferred = stripHtml(excerpt);
	if (preferred) return preferred;

	const contentText = stripHtml(content);
	if (!contentText) return "";

	const words = contentText.split(/\s+/);
	return words.slice(0, wordLimit).join(" ");
}
