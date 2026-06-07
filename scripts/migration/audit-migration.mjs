#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
	parseSeedPathArg,
	readSeedFile,
	ROOT,
} from "./lib/migration-seed-path.mjs";

const KNOWN_SHORTCODE_RE =
	/\[(?:gallery|playlist|embed|caption|youtube|list-pages|audio|video)\b[^\]]*\]/i;
const LEGACY_UPLOAD_RE =
	/(?:^|["'(=\s])(?:https?:\/\/(?:www\.)?engagedphilosophy\.com)?\/wp-content\/uploads\//i;
const ALLOWED_BLOCK_TYPES = new Set([
	"block",
	"span",
	"image",
	"gallery",
	"legacyImage",
	"legacyVideo",
	"legacyEmbed",
	"legacyPageList",
	"break",
	"numberedHeading",
	"link",
]);
const RICH_TEXT_FIELDS_BY_COLLECTION = new Map([
	[
		"pages",
		[
			"content",
			"about_html",
			"box_left_html",
			"box_middle_html",
			"box_right_html",
		],
	],
	["posts", ["content", "excerpt"]],
	["projects", ["content", "excerpt"]],
]);
const REQUIRED_RICH_TEXT_FIELDS_BY_COLLECTION = new Map([
	["pages", ["content"]],
	["posts", ["content", "excerpt"]],
	["projects", ["content", "excerpt"]],
]);

function isContentEntry(value) {
	return Boolean(value?.id && value?.data && typeof value.data === "object");
}

function entryLabel(collection, entry) {
	return `${collection}:${entry.id} ${entry.data?.path || entry.slug || ""}`.trim();
}

function walk(value, visit, pathParts = []) {
	visit(value, pathParts);
	if (Array.isArray(value)) {
		value.forEach((item, index) => walk(item, visit, [...pathParts, index]));
		return;
	}
	if (value && typeof value === "object") {
		for (const [key, item] of Object.entries(value)) {
			walk(item, visit, [...pathParts, key]);
		}
	}
}

function pathLabel(pathParts) {
	return pathParts.map((part) => String(part)).join(".");
}

function isUrlField(pathParts) {
	const field = pathParts.at(-1);
	return ["url", "src", "href"].includes(field);
}

function isMediaSourceField(pathParts) {
	return pathParts.at(-3) === "featured_image" && pathParts.at(-2) === "$media";
}

function getAssetUrl(image) {
	return image?.asset?.url || image?.url || "";
}

function getValueType(value) {
	if (Array.isArray(value)) return "array";
	if (value === null) return "null";
	return typeof value;
}

function auditRichTextFieldShape(collection, entry, issues) {
	const fields = RICH_TEXT_FIELDS_BY_COLLECTION.get(collection);
	if (!fields) return;

	const requiredFields = new Set(
		REQUIRED_RICH_TEXT_FIELDS_BY_COLLECTION.get(collection) ?? [],
	);
	for (const field of fields) {
		const hasField = Object.hasOwn(entry.data, field);
		const value = entry.data[field];
		const fieldPath = `data.${field}`;

		if (!hasField || value == null) {
			if (requiredFields.has(field)) {
				issues.push({
					type: "richTextFieldShape",
					entry: entryLabel(collection, entry),
					path: fieldPath,
					value: "missing",
				});
			}
			continue;
		}

		if (!Array.isArray(value)) {
			issues.push({
				type: "richTextFieldShape",
				entry: entryLabel(collection, entry),
				path: fieldPath,
				value: `expected Portable Text array, got ${getValueType(value)}`,
			});
			continue;
		}

		for (const [index, block] of value.entries()) {
			if (
				!block ||
				typeof block !== "object" ||
				typeof block._type !== "string"
			) {
				issues.push({
					type: "richTextFieldShape",
					entry: entryLabel(collection, entry),
					path: `${fieldPath}.${index}`,
					value: `expected Portable Text block, got ${getValueType(block)}`,
				});
			}
		}
	}
}

function auditEntry(collection, entry, issues) {
	auditRichTextFieldShape(collection, entry, issues);

	walk(entry, (value, pathParts) => {
		if (typeof value === "string") {
			if (KNOWN_SHORTCODE_RE.test(value)) {
				issues.push({
					type: "shortcodeLeak",
					entry: entryLabel(collection, entry),
					path: pathLabel(pathParts),
					value,
				});
			}
			if (
				isUrlField(pathParts) &&
				!isMediaSourceField(pathParts) &&
				LEGACY_UPLOAD_RE.test(value)
			) {
				issues.push({
					type: "legacyUploadLeak",
					entry: entryLabel(collection, entry),
					path: pathLabel(pathParts),
					value,
				});
			}
			return;
		}

		if (!value || typeof value !== "object") return;

		if (
			typeof value._type === "string" &&
			!ALLOWED_BLOCK_TYPES.has(value._type)
		) {
			issues.push({
				type: "unknownBlockType",
				entry: entryLabel(collection, entry),
				path: pathLabel(pathParts),
				value: value._type,
			});
		}

		if (value._type === "gallery") {
			for (const [index, image] of (value.images ?? []).entries()) {
				if (!getAssetUrl(image)) {
					issues.push({
						type: "emptyGalleryImage",
						entry: entryLabel(collection, entry),
						path: `${pathLabel(pathParts)}.images.${index}`,
						value: image?._key || "",
					});
				}
			}
		}

		if (value._type === "legacyVideo" && !value.url) {
			issues.push({
				type: "emptyLegacyVideo",
				entry: entryLabel(collection, entry),
				path: pathLabel(pathParts),
				value: value._key || "",
			});
		}

		if (value._type === "legacyEmbed" && !value.embedUrl) {
			issues.push({
				type: "emptyLegacyEmbed",
				entry: entryLabel(collection, entry),
				path: pathLabel(pathParts),
				value: value.url || value._key || "",
			});
		}
	});
}

function auditSeed(seed) {
	const issues = [];
	for (const [collection, entries] of Object.entries(seed.content ?? {})) {
		for (const entry of entries ?? []) {
			if (isContentEntry(entry)) auditEntry(collection, entry, issues);
		}
	}
	return issues;
}

const seedPath = parseSeedPathArg(process.argv.slice(2));
if (!fs.existsSync(seedPath)) {
	console.log(
		`Migration seed not found at ${path.relative(ROOT, seedPath)}; skipping migration audit.`,
	);
	process.exit(0);
}

const seed = readSeedFile(seedPath);
const issues = auditSeed(seed);

if (issues.length === 0) {
	console.log(`Migration audit passed for ${path.relative(ROOT, seedPath)}.`);
	process.exit(0);
}

console.error(
	`Migration audit found ${issues.length} issue(s) in ${path.relative(ROOT, seedPath)}:`,
);
for (const issue of issues.slice(0, 50)) {
	console.error(
		[
			`- ${issue.type}`,
			issue.entry,
			issue.path,
			JSON.stringify(issue.value).slice(0, 180),
		].join(" | "),
	);
}
if (issues.length > 50) {
	console.error(`...and ${issues.length - 50} more.`);
}
process.exit(1);
