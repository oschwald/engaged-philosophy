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

// Shortcodes the WordPress import handled, plus the List Pages plugin's
// sibling tags and Vimeo, which the embeds plugin supports. Other bracketed
// text is left alone: a stray shortcode in an excerpt is visible and fixable,
// while a deleted editorial bracket such as "[W]e" silently changes a
// quotation.
const KNOWN_WORDPRESS_SHORTCODES = [
	"audio",
	"caption",
	"child-pages",
	"embed",
	"gallery",
	"list-pages",
	"playlist",
	"sibling-pages",
	"video",
	"vimeo",
	"wp_caption",
	"youtube",
];

// Tags that are complete without attributes or a closing tag. Other bare tags,
// such as "[video]" or "[gallery]", are also everyday words, so they only count
// as shortcodes when their own closing tag follows.
const BARE_SHORTCODES = new Set(["child-pages", "list-pages", "sibling-pages"]);

// Shortcode names that are also everyday words in alternatives.
const WORD_SHORTCODES = new Set(["audio", "video"]);

// Tags that take a positional URL, such as "[audio https://...|titles=...]".
const URL_SHORTCODES = new Set(["audio", "vimeo", "youtube"]);

// Tags that take a positional ID, such as "[youtube 67-3Jr2QWcg]" or
// "[vimeo 141358]". Words and years such as "[youtube Documentary]",
// "[youtube WomenInTech]", "[youtube 2020-update]" or "[vimeo 2019]" stay as
// text. YouTube IDs almost always hold an uppercase letter.
function isShortcodeId(name: string, value: string) {
	const id = value.replace(/[?&]\S*$/, "");
	if (name === "vimeo") return /^\d{5,}$/.test(id);
	if (name !== "youtube") return false;

	if (!/^[\w-]{11}$/.test(id) || !/[A-Z]/.test(id)) return false;
	if (/\d/.test(id)) return true;
	// Without a digit, an ID mixes cases in a way words do not.
	const letters = id.replace(/[-_]/g, "");
	return (
		/[a-z]/.test(letters) &&
		/[A-Z]/.test(letters) &&
		!/^[A-Za-z]?[a-z]*(?:[A-Z][a-z]+)+$/.test(letters)
	);
}

// Boolean flags that WordPress media shortcodes accept without a value.
const FLAG_ARGUMENTS = new Set([
	"autoplay",
	"controls",
	"loop",
	"muted",
	"playsinline",
]);

// WordPress shortcode names are case-sensitive, so "[Video]" was never a
// shortcode, and attributes cannot contain "[" or "]".
const SHORTCODE_PATTERN = new RegExp(
	String.raw`\[(\/)?(${KNOWN_WORDPRESS_SHORTCODES.join("|")})(?![\w-])([^[\]]*)\]`,
	"g",
);

// Quoted values may use the curly quotes and primes that WordPress's
// wptexturize produced. A value may also hold its own quote mark, as in a
// decoded caption="Kant's "Critique" cover", so a quote ends the value only
// before the next attribute, a media flag or the end of the tag.
const NEXT_ATTRIBUTE = String.raw`\s+[a-z_][\w-]*\s*=`;
const NEXT_FLAG = String.raw`\s+(?:${[...FLAG_ARGUMENTS].join("|")})(?!\S)`;
const VALUE_END = String.raw`(?=${NEXT_ATTRIBUTE}|${NEXT_FLAG}|\s*$)`;
function quotedValue(quotes: string) {
	const quote = `[${quotes}]`;
	const innerQuote = `${quote}(?!${VALUE_END})`;
	return `${quote}(?:[^${quotes}]|${innerQuote})*${quote}${VALUE_END}`;
}
const QUOTE_CLASSES = [
	'"',
	"'",
	String.raw`\u201c\u201d\u2033`,
	String.raw`\u2018\u2019\u2032`,
];
const QUOTED_VALUE = QUOTE_CLASSES.map(quotedValue).join("|");
const ANY_QUOTE = `[${QUOTE_CLASSES.join("")}]`;
const UNWRAP_QUOTES = new RegExp(`^${ANY_QUOTE}(.*)${ANY_QUOTE}$`);
// An attribute list whose first quoted value runs to the last quote, as in
// caption="Hofstadter's "strange" loop", where the inner words would
// otherwise read as flags or attributes.
const QUOTED_TO_END_PATTERNS = QUOTE_CLASSES.map(
	(quotes) =>
		new RegExp(
			String.raw`^[a-z_][\w-]*\s*=\s*[${quotes}][\s\S]*[${quotes}]$`,
			"i",
		),
);
const QUOTED_ATTRIBUTE_PATTERN = new RegExp(
	String.raw`[a-z_][\w-]*\s*=\s*(?:${QUOTED_VALUE})`,
	"gi",
);
const UNQUOTED_ATTRIBUTE_PATTERN = /(?:^|\s)[a-z_][\w-]*=[^\s"']+(?=\s|$)/gi;

// WordPress escapes literal shortcode text with doubled brackets, as in
// "[[gallery]]" or "[[video]clip[/video]]". A tag inside the extra bracket
// stays as text.
function isEscaped(value: string, start: number, end: number, closing = false) {
	return closing ? value[end] === "]" : value[start - 1] === "[";
}

// Jetpack also takes protocol-relative and scheme-less video URLs.
const SCHEMELESS_URL =
	/^(?:www\.|youtu\.be\/|(?:[\w-]+\.)*(?:vimeo|youtube)\.com\/)\S+$/i;

// The old Audio Player plugin also took site paths and comma-separated file
// names.
const AUDIO_FILE = String.raw`[\w.-]+\.(?:mp3|m4a|oga|ogg|wav)`;
const AUDIO_PATH = new RegExp(
	String.raw`^(?:\/[^\s|]+|${AUDIO_FILE}(?:,${AUDIO_FILE})*)$`,
	"i",
);

function isMediaSource(name: string, value: string) {
	if (!URL_SHORTCODES.has(name)) return false;
	return isUrl(value) || (name === "audio" && AUDIO_PATH.test(value));
}

// A closing "/" stands apart from the arguments, so the slash ending a URL
// such as "[audio https://example.com/ep1/]" does not count.
const SELF_CLOSING_TAG = /(?:^\[[\w-]+|[\s"'\u201d\u2033\u2019\u2032])\/\]$/;

function isUrl(value: string) {
	return /^(?:https?:)?\/\/\S+$/i.test(value) || SCHEMELESS_URL.test(value);
}

function firstIndexAfter(
	indexes: number[],
	position: number,
): number | undefined {
	let low = 0;
	let high = indexes.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if ((indexes[middle] ?? 0) < position) low = middle + 1;
		else high = middle;
	}
	return indexes[low];
}

function findTagIndexes(value: string, pattern: RegExp, closing = false) {
	const indexes: number[] = [];
	for (const match of value.matchAll(pattern)) {
		const start = match.index ?? 0;
		const tag = match[0];
		// Escaped and self-closing tags never pair with a closing tag.
		if (isEscaped(value, start, start + tag.length, closing)) continue;
		if (SELF_CLOSING_TAG.test(tag)) continue;
		indexes.push(start);
	}
	return indexes;
}

// Like WordPress, a tag ending at `end` pairs with the first closing tag of
// the same name after it. The pair is "blocked" when another opening tag of
// that name comes first; text such as "[video plays]" counts as an opening
// tag here, so a doubtful pair keeps its text.
function createClosingLookup(value: string) {
	const cache = new Map<string, { closings: number[]; openings: number[] }>();

	return (name: string, end: number) => {
		let positions = cache.get(name);
		if (!positions) {
			positions = {
				closings: findTagIndexes(
					value,
					new RegExp(String.raw`\[\/${name}\]`, "g"),
					true,
				),
				openings: findTagIndexes(
					value,
					new RegExp(String.raw`\[${name}(?![\w-])[^[\]]*\]`, "g"),
				),
			};
			cache.set(name, positions);
		}

		const closingIndex = firstIndexAfter(positions.closings, end);
		if (closingIndex === undefined) return { closingIndex, blocked: false };
		const openingIndex = firstIndexAfter(positions.openings, end);
		const blocked = openingIndex !== undefined && openingIndex < closingIndex;
		return { closingIndex, blocked };
	};
}

// Real attribute lists are short; this bounds the work on long bracketed text.
const MAX_ARGUMENTS_LENGTH = 5000;

function isShortcodeArguments(name: string, args: string, isClosed: boolean) {
	if (args.length > MAX_ARGUMENTS_LENGTH) return false;
	// Jetpack's "[youtube=https://...]" and "[vimeo=https://...]" forms.
	if (args.startsWith("=")) {
		const value = args.slice(1).trim().replace(UNWRAP_QUOTES, "$1");
		const takesId = name === "youtube" || name === "vimeo";
		return takesId && (isShortcodeId(name, value) || isUrl(value));
	}
	// The old Audio Player plugin's "[audio:https://...|titles=...]" form.
	if (args.startsWith(":")) {
		const value = args.slice(1).trim();
		const source = value.split(/[|\s]/, 1)[0] ?? "";
		return name === "audio" && isMediaSource(name, source);
	}
	if (!/^\s/.test(args)) return false;

	const trimmedArgs = args.trim();
	const firstToken = trimmedArgs.split(/\s/, 1)[0] ?? "";
	// Jetpack's "[audio https://...|titles=...]" form.
	const isPipeUrl = isUrl(firstToken) && firstToken.includes("|");
	if (URL_SHORTCODES.has(name) && isPipeUrl) return true;
	if (QUOTED_TO_END_PATTERNS.some((pattern) => pattern.test(trimmedArgs))) {
		return true;
	}

	const rest = trimmedArgs
		.replace(QUOTED_ATTRIBUTE_PATTERN, " ")
		.replace(UNQUOTED_ATTRIBUTE_PATTERN, " ")
		.trim();
	// Brackets around HTML markup are prose, not attributes.
	if (/[<>]/.test(rest)) return false;
	if (rest === "") return true;

	// What is left may be one positional URL or ID and media flags such as
	// "loop". Flags alone count only alongside attributes or a closing tag.
	let positionals = 0;
	for (const token of rest.split(/\s+/)) {
		// WordPress lowercases attribute names, so "Loop" is a flag too.
		if (FLAG_ARGUMENTS.has(token.toLowerCase())) continue;
		if (!isMediaSource(name, token) && !isShortcodeId(name, token)) {
			return false;
		}
		positionals += 1;
	}
	if (positionals > 1) return false;
	return positionals === 1 || rest !== trimmedArgs || isClosed;
}

function stripWordPressShortcodes(value: string) {
	const findClosingTag = createClosingLookup(value);
	// Closing tags claimed by a stripped opening tag, by position.
	const claimedClosings = new Set<number>();

	return value.replace(
		SHORTCODE_PATTERN,
		(match, closing, name: string, rawArgs: string, offset: number) => {
			const end = offset + match.length;
			if (isEscaped(value, offset, end, Boolean(closing))) return match;

			if (closing) {
				if (claimedClosings.has(offset)) return " ";
				// Keep alternatives such as "the audio[/video] talk"; other closing
				// tags without an opening tag are shortcode leftovers.
				const isAlternative = /\w/.test(value[offset - 1] ?? "");
				return isAlternative && WORD_SHORTCODES.has(name) ? match : " ";
			}

			const selfClosing = SELF_CLOSING_TAG.test(match);
			// Markup inside a shortcode, such as a <br /> or an auto-linked URL,
			// only separates its arguments.
			const args = (selfClosing ? rawArgs.slice(0, -1) : rawArgs).replace(
				/\uE000/g,
				" ",
			);
			const hasArguments = Boolean(args.trim());
			const { closingIndex, blocked } = selfClosing
				? { closingIndex: undefined, blocked: false }
				: findClosingTag(name, end);
			const isClosed = closingIndex !== undefined && !blocked;

			if (hasArguments) {
				if (!isShortcodeArguments(name, args, isClosed)) return match;
			} else if (!selfClosing && !BARE_SHORTCODES.has(name) && !isClosed) {
				return match;
			}

			// A tag with attributes is plainly a shortcode, so it takes the next
			// closing tag even past bracketed text such as "[video plays]". A
			// closing tag already taken belongs to an outer tag, as in WordPress.
			if (closingIndex !== undefined && (isClosed || hasArguments)) {
				claimedClosings.add(closingIndex);
			}
			return " ";
		},
	);
}

// A well-formed HTML tag: quoted attribute values end before a space, "/" or
// ">", and nothing outside them is a bracket or another "<".
const TAG_BOUNDARY = " \uE000 ";
const HTML_TAG_PATTERN =
	/<\/?[a-z](?:[^<>"'[\]]|"[^">]*"(?=[\s/>])|'[^'>]*'(?=[\s/>]))*>/gi;

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

	// Remove markup first so a shortcode hidden in a comment, script or
	// attribute cannot pair with visible text. Only well-formed tags go here,
	// so a stray "<" in prose or a shortcode attribute cannot swallow a
	// shortcode.
	// Removed markup leaves a boundary mark, so the last pass over leftover
	// "<...>" cannot run from a stray "<" across other paragraphs.
	const visibleText = decodeHtmlEntities(value)
		.replace(/<script[\s\S]*?<\/script>/gi, TAG_BOUNDARY)
		.replace(/<style[\s\S]*?<\/style>/gi, TAG_BOUNDARY)
		.replace(/<!--[\s\S]*?-->/g, TAG_BOUNDARY)
		.replace(HTML_TAG_PATTERN, TAG_BOUNDARY);

	return stripWordPressShortcodes(visibleText)
		.replace(/<[^<>\uE000]+>/g, " ")
		.replace(/\uE000/g, " ")
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
