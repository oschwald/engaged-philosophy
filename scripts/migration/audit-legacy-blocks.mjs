#!/usr/bin/env node

import path from "node:path";
import process from "node:process";

import {
	parseSeedPathArg,
	readSeedFile,
	ROOT,
} from "./lib/migration-seed-path.mjs";
import {
	EMDASH_MEDIA_FILE_PREFIX,
	uploadStorageKeyFromUrl,
} from "./lib/wordpress-media.mjs";

const TRACKED_BLOCK_TYPES = [
	"legacyImage",
	"gallery",
	"legacyVideo",
	"legacyEmbed",
	"legacyPageList",
	"numberedHeading",
	"break",
];
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
const MAX_SAMPLES = 8;

function createTypeCounts() {
	return Object.fromEntries(TRACKED_BLOCK_TYPES.map((type) => [type, 0]));
}

function entryLabel(collection, entry) {
	return `${collection}:${entry.id} ${entry.data?.path || entry.slug || ""}`.trim();
}

function blockLabel(collection, entry, field, index) {
	return `${entryLabel(collection, entry)} data.${field}.${index}`;
}

function pushSample(samples, value) {
	if (samples.length < MAX_SAMPLES) samples.push(value);
}

function countFeature(counts, feature) {
	counts[feature] = (counts[feature] ?? 0) + 1;
}

function isSet(value) {
	return (
		value !== undefined && value !== null && value !== "" && value !== "none"
	);
}

function hasAssetRef(node) {
	return typeof node?.asset?._ref === "string" && node.asset._ref.length > 0;
}

function getLegacyImageSource(node) {
	return (
		(typeof node?.id === "string" && node.id) ||
		(typeof node?.url === "string" && node.url) ||
		(typeof node?.asset?.url === "string" && node.asset.url) ||
		""
	);
}

function isInternalMediaUrl(value) {
	return (
		typeof value === "string" && value.startsWith(EMDASH_MEDIA_FILE_PREFIX)
	);
}

function hasMediaReference(node) {
	return hasAssetRef(node) || isInternalMediaUrl(getLegacyImageSource(node));
}

function hasRawUploadSource(node) {
	const source = getLegacyImageSource(node);
	return Boolean(
		source && !isInternalMediaUrl(source) && uploadStorageKeyFromUrl(source),
	);
}

function legacyImageReductionBlockers(node) {
	const blockers = [];
	if (!hasMediaReference(node)) blockers.push("missing media ref");
	if (hasRawUploadSource(node)) blockers.push("raw upload source");
	if (isSet(node.align)) blockers.push("alignment");
	if (isSet(node.href)) blockers.push("link");
	if (isSet(node.shape)) blockers.push("shape");
	return blockers;
}

function visitBlocks(blocks, visit) {
	if (!Array.isArray(blocks)) return;
	blocks.forEach((block, index) => {
		visit(block, index);
		if (block && typeof block === "object") {
			if (Array.isArray(block.images)) {
				visitBlocks(block.images, visit);
			}
			if (Array.isArray(block.columns)) {
				for (const column of block.columns) {
					visitBlocks(column?.content, visit);
				}
			}
		}
	});
}

function auditSeed(seed) {
	const summary = {
		total: createTypeCounts(),
		byCollection: {},
		legacyImage: {
			total: 0,
			mediaBacked: 0,
			rawUploadSource: 0,
			standardImageCandidates: 0,
			blockedByFeature: {},
			candidateSamples: [],
			blockedSamples: [],
		},
	};

	for (const [collection, entries] of Object.entries(seed.content ?? {})) {
		const fields = RICH_TEXT_FIELDS_BY_COLLECTION.get(collection) ?? [];
		summary.byCollection[collection] = createTypeCounts();

		for (const entry of entries ?? []) {
			for (const field of fields) {
				visitBlocks(entry.data?.[field], (block, index) => {
					const type = block?._type;
					if (!TRACKED_BLOCK_TYPES.includes(type)) return;

					summary.total[type] += 1;
					summary.byCollection[collection][type] += 1;

					if (type !== "legacyImage") return;

					summary.legacyImage.total += 1;
					if (hasMediaReference(block)) {
						summary.legacyImage.mediaBacked += 1;
					}
					if (hasRawUploadSource(block)) {
						summary.legacyImage.rawUploadSource += 1;
					}
					const blockers = legacyImageReductionBlockers(block);
					if (blockers.length === 0) {
						summary.legacyImage.standardImageCandidates += 1;
						pushSample(
							summary.legacyImage.candidateSamples,
							blockLabel(collection, entry, field, index),
						);
						return;
					}

					for (const blocker of blockers) {
						countFeature(summary.legacyImage.blockedByFeature, blocker);
					}
					pushSample(summary.legacyImage.blockedSamples, {
						location: blockLabel(collection, entry, field, index),
						blockers,
					});
				});
			}
		}
	}

	return summary;
}

function formatCounts(counts) {
	return TRACKED_BLOCK_TYPES.map((type) => `${type}=${counts[type]}`).join(
		", ",
	);
}

function printSummary(seedPath, summary) {
	console.log(
		`Legacy block audit for ${path.relative(ROOT, seedPath) || seedPath}`,
	);
	console.log(formatCounts(summary.total));
	console.log(
		`legacyImage standard-image candidates=${summary.legacyImage.standardImageCandidates}/${summary.legacyImage.total}`,
	);
	console.log(
		`legacyImage media-backed=${summary.legacyImage.mediaBacked}/${summary.legacyImage.total}, raw upload source=${summary.legacyImage.rawUploadSource}`,
	);

	const blockers = Object.entries(summary.legacyImage.blockedByFeature)
		.sort((left, right) => right[1] - left[1])
		.map(([feature, count]) => `${feature}=${count}`)
		.join(", ");
	if (blockers) {
		console.log(`legacyImage blockers: ${blockers}`);
	}

	console.log("By collection:");
	for (const [collection, counts] of Object.entries(summary.byCollection)) {
		console.log(`- ${collection}: ${formatCounts(counts)}`);
	}

	if (summary.legacyImage.candidateSamples.length > 0) {
		console.log("Standard-image candidate samples:");
		for (const sample of summary.legacyImage.candidateSamples) {
			console.log(`- ${sample}`);
		}
	}

	if (summary.legacyImage.blockedSamples.length > 0) {
		console.log("Blocked legacyImage samples:");
		for (const sample of summary.legacyImage.blockedSamples) {
			console.log(`- ${sample.location}: ${sample.blockers.join(", ")}`);
		}
	}
}

const seedPath = parseSeedPathArg(process.argv.slice(2));
const seed = readSeedFile(seedPath);
const summary = auditSeed(seed);
printSummary(seedPath, summary);
