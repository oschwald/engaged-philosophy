#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
	DEFAULT_MIGRATION_SEED_PATH,
	readSeedFile,
	resolveSeedPath,
	ROOT,
} from "./lib/migration-seed-path.mjs";

const DEFAULT_WXR_PATH = path.join(
	ROOT,
	"engagedphilosophy.WordPress.2026-05-25.xml",
);
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const ITEM_RE = /<item>([\s\S]*?)<\/item>/g;
const META_RE =
	/<wp:postmeta>\s*<wp:meta_key><!\[CDATA\[(.*?)\]\]><\/wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(.*?)\]\]><\/wp:meta_value>\s*<\/wp:postmeta>/gs;

const SOURCE_FIELDS = [
	{ source: "content:encoded", seed: "content", label: "content" },
	{ source: "excerpt:encoded", seed: "excerpt", label: "excerpt" },
	{ meta: "about", seed: "about_html", label: "about" },
	{ meta: "box-left", seed: "box_left_html", label: "box-left" },
	{ meta: "box-middle", seed: "box_middle_html", label: "box-middle" },
	{ meta: "box-right", seed: "box_right_html", label: "box-right" },
];

function parseArgs(argv) {
	const options = {
		seedPath: DEFAULT_MIGRATION_SEED_PATH,
		wxrPath: DEFAULT_WXR_PATH,
	};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		const next = argv[i + 1];
		if (arg === "--seed" && next && !next.startsWith("--")) {
			options.seedPath = resolveSeedPath(next);
			i += 1;
		} else if (arg === "--wxr" && next && !next.startsWith("--")) {
			options.wxrPath = path.resolve(ROOT, next);
			i += 1;
		}
	}
	return options;
}

function readText(filePath) {
	return fs.readFileSync(filePath, "utf8").replace(CONTROL_CHARS, "");
}

function extractTag(source, tag) {
	const cdataMatch = source.match(
		new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "s"),
	);
	if (cdataMatch) return cdataMatch[1].trim();

	const plainMatch = source.match(
		new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "s"),
	);
	return plainMatch ? plainMatch[1].trim() : "";
}

function decodeEntities(value) {
	const namedEntities = {
		amp: "&",
		apos: "'",
		quot: '"',
		nbsp: " ",
	};

	return (value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, token) => {
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

function parseAttributes(value) {
	const attributes = {};
	for (const match of (value || "").matchAll(
		/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+)))?/g,
	)) {
		attributes[match[1].toLowerCase()] = decodeEntities(
			match[2] ?? match[3] ?? match[4] ?? "",
		);
	}
	return attributes;
}

function normalizePathname(value) {
	const pathname = (value || "").replace(/^\/+|\/+$/g, "");
	return pathname ? `/${pathname}/` : "/";
}

function seedEntriesByLegacyId(seed) {
	const entries = new Map();
	for (const [collection, collectionEntries] of Object.entries(
		seed.content ?? {},
	)) {
		for (const entry of collectionEntries ?? []) {
			const legacyId = entry?.data?.legacy_wp_id;
			if (legacyId == null) continue;
			entries.set(String(legacyId), { collection, entry });
		}
	}
	return entries;
}

function mediaByLegacyId(wxr) {
	const media = {};
	for (const match of wxr.matchAll(ITEM_RE)) {
		const item = match[1];
		if (extractTag(item, "wp:post_type") !== "attachment") continue;
		const id = extractTag(item, "wp:post_id");
		const url = extractTag(item, "wp:attachment_url");
		if (!id || !url) continue;
		media[id] = { url };
	}
	return media;
}

function walk(value, visit) {
	visit(value);
	if (Array.isArray(value)) {
		value.forEach((item) => walk(item, visit));
		return;
	}
	if (value && typeof value === "object") {
		Object.values(value).forEach((item) => walk(item, visit));
	}
}

function countSeedBlocks(value) {
	const counts = {
		shortcodeGallery: 0,
		legacyVideo: 0,
		legacyEmbed: 0,
		legacyPageList: 0,
	};
	walk(value, (item) => {
		if (!item || typeof item !== "object") return;
		if (item._type === "gallery" && item.layout === "shortcode") {
			counts.shortcodeGallery += 1;
		} else if (item._type === "legacyVideo") {
			counts.legacyVideo += 1;
		} else if (item._type === "legacyEmbed") {
			counts.legacyEmbed += 1;
		} else if (item._type === "legacyPageList") {
			counts.legacyPageList += 1;
		}
	});
	return counts;
}

function cleanUrl(value) {
	return decodeEntities(value || "")
		.replace(/^https?:\/\/(https?:\/\/)/i, "$1")
		.replace(/[)\].,;]+$/g, "")
		.trim();
}

function isVideoUrl(value) {
	return /\.(?:mp4|m4v|mov|webm|ogv)(?:[?#].*)?$/i.test(cleanUrl(value));
}

function isEmbeddableUrl(value) {
	let parsed;
	try {
		parsed = new URL(cleanUrl(value));
	} catch {
		return false;
	}
	const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
	return (
		host === "youtube.com" ||
		host === "youtu.be" ||
		host === "youtube-nocookie.com" ||
		host === "vimeo.com" ||
		host === "animoto.com"
	);
}

function getResolvableMediaIds(attributes, mediaById) {
	return (attributes.ids || "")
		.split(",")
		.map((id) => id.trim())
		.filter((id) => Boolean(id && mediaById[id]?.url));
}

function createExpectations() {
	return {
		shortcodeGallery: 0,
		legacyVideo: 0,
		legacyEmbed: 0,
		legacyPageList: 0,
		samples: {
			shortcodeGallery: [],
			legacyVideo: [],
			legacyEmbed: [],
			legacyPageList: [],
		},
	};
}

function pushSample(expectations, key, value) {
	if (expectations.samples[key].length < 5) {
		expectations.samples[key].push(value);
	}
}

function stripExplicitEmbedsAndLinks(value) {
	return (value || "")
		.replace(/\[embed\][\s\S]*?\[\/embed\]/gi, "")
		.replace(/\[youtube\b[^\]]*\]/gi, "")
		.replace(/<a\b[\s\S]*?<\/a>/gi, "");
}

function countStandaloneEmbeds(source, expectations) {
	for (const line of stripExplicitEmbedsAndLinks(source).split(/\r?\n/)) {
		const text = decodeEntities(line)
			.replace(/<[^>]*>/g, "")
			.trim();
		if (!/^https?:\/\/\S+$/i.test(text)) continue;
		if (!isEmbeddableUrl(text)) continue;
		expectations.legacyEmbed += 1;
		pushSample(expectations, "legacyEmbed", cleanUrl(text));
	}
}

function sourceExpectations(source, { mediaById, autoEmbedStandaloneUrls }) {
	const expectations = createExpectations();

	for (const match of (source || "").matchAll(/\[gallery\b([^\]]*)\]/gi)) {
		const attributes = parseAttributes(match[1]);
		if (getResolvableMediaIds(attributes, mediaById).length === 0) continue;
		expectations.shortcodeGallery += 1;
		pushSample(expectations, "shortcodeGallery", match[0]);
	}

	for (const match of (source || "").matchAll(/\[playlist\b([^\]]*)\]/gi)) {
		const attributes = parseAttributes(match[1]);
		const count = getResolvableMediaIds(attributes, mediaById).filter((id) =>
			isVideoUrl(mediaById[id].url),
		).length;
		if (count === 0) continue;
		expectations.legacyVideo += count;
		pushSample(expectations, "legacyVideo", match[0]);
	}

	for (const match of (source || "").matchAll(
		/\[embed\]([\s\S]*?)\[\/embed\]/gi,
	)) {
		const url = cleanUrl(match[1]);
		if (isVideoUrl(url)) {
			expectations.legacyVideo += 1;
			pushSample(expectations, "legacyVideo", url);
		} else if (isEmbeddableUrl(url)) {
			expectations.legacyEmbed += 1;
			pushSample(expectations, "legacyEmbed", url);
		}
	}

	for (const match of (source || "").matchAll(/\[youtube\b([^\]]*)\]/gi)) {
		expectations.legacyEmbed += 1;
		pushSample(expectations, "legacyEmbed", match[0]);
	}

	for (const match of (source || "").matchAll(/\[list-pages\b[^\]]*\]/gi)) {
		expectations.legacyPageList += 1;
		pushSample(expectations, "legacyPageList", match[0]);
	}

	if (autoEmbedStandaloneUrls) {
		countStandaloneEmbeds(source, expectations);
	}

	return expectations;
}

function hasExpectations(expectations) {
	return (
		expectations.shortcodeGallery > 0 ||
		expectations.legacyVideo > 0 ||
		expectations.legacyEmbed > 0 ||
		expectations.legacyPageList > 0
	);
}

function compareCounts({ sourceCounts, seedCounts, entryLabel, fieldLabel }) {
	const checks = [
		{
			type: "missingGalleryShortcodeBlock",
			key: "shortcodeGallery",
			actualKey: "shortcodeGallery",
		},
		{
			type: "missingLegacyVideoBlock",
			key: "legacyVideo",
			actualKey: "legacyVideo",
		},
		{
			type: "missingLegacyEmbedBlock",
			key: "legacyEmbed",
			actualKey: "legacyEmbed",
		},
		{
			type: "missingPageListBlock",
			key: "legacyPageList",
			actualKey: "legacyPageList",
		},
	];
	const issues = [];
	for (const check of checks) {
		const expected = sourceCounts[check.key];
		const actual = seedCounts[check.actualKey];
		if (expected <= actual) continue;
		issues.push({
			type: check.type,
			entry: entryLabel,
			field: fieldLabel,
			expected,
			actual,
			samples: sourceCounts.samples[check.key],
		});
	}
	return issues;
}

function getSourceFields(item) {
	const metas = Object.fromEntries(
		[...item.matchAll(META_RE)].map((match) => [match[1], match[2]]),
	);
	return SOURCE_FIELDS.map((field) => ({
		label: field.label,
		seed: field.seed,
		autoEmbedStandaloneUrls: field.seed !== "excerpt",
		value: field.source
			? extractTag(item, field.source)
			: metas[field.meta] || "",
	}));
}

function entryLabel(collection, entry) {
	const pathLabel = normalizePathname(entry.data?.path || "");
	return `${collection}:${entry.id} ${pathLabel}`;
}

function auditWordPressTransforms(seed, wxr) {
	const seedByLegacyId = seedEntriesByLegacyId(seed);
	const mediaById = mediaByLegacyId(wxr);
	const issues = [];

	for (const match of wxr.matchAll(ITEM_RE)) {
		const item = match[1];
		const postType = extractTag(item, "wp:post_type");
		if (!["page", "post", "project"].includes(postType)) continue;
		const status = extractTag(item, "wp:status");
		if (!["publish", "draft"].includes(status)) continue;

		const postId = extractTag(item, "wp:post_id");
		const seedMatch = seedByLegacyId.get(postId);
		if (!seedMatch) continue;

		const label = entryLabel(seedMatch.collection, seedMatch.entry);
		for (const field of getSourceFields(item)) {
			if (!field.value) continue;
			const sourceCounts = sourceExpectations(field.value, {
				mediaById,
				autoEmbedStandaloneUrls: field.autoEmbedStandaloneUrls,
			});
			if (!hasExpectations(sourceCounts)) continue;
			const seedCounts = countSeedBlocks(seedMatch.entry.data?.[field.seed]);
			issues.push(
				...compareCounts({
					sourceCounts,
					seedCounts,
					entryLabel: label,
					fieldLabel: field.label,
				}),
			);
		}
	}

	return issues;
}

const options = parseArgs(process.argv.slice(2));

if (!fs.existsSync(options.seedPath)) {
	console.log(
		`Migration seed not found at ${path.relative(ROOT, options.seedPath)}; skipping WordPress transform audit.`,
	);
	process.exit(0);
}

if (!fs.existsSync(options.wxrPath)) {
	console.log(
		`WordPress export not found at ${path.relative(ROOT, options.wxrPath)}; skipping WordPress transform audit.`,
	);
	process.exit(0);
}

const seed = readSeedFile(options.seedPath);
const wxr = readText(options.wxrPath);
const issues = auditWordPressTransforms(seed, wxr);

if (issues.length === 0) {
	console.log(
		`WordPress transform audit passed for ${path.relative(ROOT, options.wxrPath)}.`,
	);
	process.exit(0);
}

console.error(
	`WordPress transform audit found ${issues.length} issue(s) in ${path.relative(ROOT, options.wxrPath)}:`,
);
for (const issue of issues.slice(0, 50)) {
	console.error(
		[
			`- ${issue.type}`,
			issue.entry,
			issue.field,
			`expected ${issue.expected}`,
			`actual ${issue.actual}`,
			JSON.stringify(issue.samples).slice(0, 240),
		].join(" | "),
	);
}
if (issues.length > 50) {
	console.error(`...and ${issues.length - 50} more.`);
}
process.exitCode = 1;
