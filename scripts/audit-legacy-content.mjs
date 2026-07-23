#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

const INVENTORY_FORMAT = "engaged-philosophy-legacy-content-inventory";
const INVENTORY_FORMAT_VERSION = 1;

const usage = `Usage: pnpm run audit:legacy-content -- --input <backup.json> [--json]

Inspect a downloaded EmDash backup for content that still depends on this site's
legacy Portable Text renderers. The command is read-only and writes only to stdout.

Options:
  --input <backup.json>  EmDash backup downloaded from the admin UI
  --json                 Emit deterministic JSON instead of a text summary
  --help                 Show this help`;

function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasValue(value) {
	return (
		value !== undefined &&
		value !== null &&
		value !== "" &&
		value !== false &&
		value !== "none"
	);
}

function asString(value) {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safelyDecode(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function sortedRecord(record) {
	return Object.fromEntries(
		Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
	);
}

function compareValues(left, right) {
	return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
		numeric: true,
	});
}

function compareOccurrences(left, right) {
	return (
		compareValues(left.collection, right.collection) ||
		compareValues(left.entryId, right.entryId) ||
		compareValues(left.sourceKind, right.sourceKind) ||
		compareValues(left.revisionId, right.revisionId) ||
		compareValues(left.field, right.field) ||
		compareValues(left.blockPath, right.blockPath) ||
		compareValues(left.type, right.type)
	);
}

function makeSource(row, collection, field, sourceKind, contentRow) {
	const source = {
		sourceKind,
		collection,
		entryId:
			sourceKind === "revision"
				? (row.entry_id ?? row.entryId ?? "unknown")
				: (row.id ?? "unknown"),
		field,
	};

	if (sourceKind === "revision") {
		source.revisionId = row.id ?? "unknown";
	}

	const status = asString(contentRow?.status ?? row.status);
	const slug = asString(contentRow?.slug ?? row.slug);
	const entryPath = asString(contentRow?.path ?? row.path);

	if (status) source.status = status;
	if (hasValue(contentRow?.deleted_at ?? contentRow?.deletedAt)) {
		source.trashed = true;
	}
	if (slug) source.slug = slug;
	if (entryPath) source.entryPath = entryPath;

	return source;
}

function diagnostic(code, source, message) {
	return {
		code,
		...source,
		message,
	};
}

function parsePortableText(value, source, diagnostics) {
	if (value === undefined || value === null || value === "") return undefined;

	let parsed = value;
	if (typeof value === "string") {
		try {
			parsed = JSON.parse(value);
		} catch {
			diagnostics.push(
				diagnostic(
					"invalid-portable-text-json",
					source,
					"The field is not valid JSON.",
				),
			);
			return undefined;
		}
	}

	if (!Array.isArray(parsed)) {
		diagnostics.push(
			diagnostic(
				"invalid-portable-text-value",
				source,
				"The field does not contain a Portable Text array.",
			),
		);
		return undefined;
	}

	return parsed;
}

function parseRevisionData(row, diagnostics) {
	const source = {
		sourceKind: "revision",
		collection: asString(row.collection) ?? "unknown",
		entryId: row.entry_id ?? row.entryId ?? "unknown",
		revisionId: row.id ?? "unknown",
		field: "(revision data)",
	};

	if (isRecord(row.data)) return row.data;
	if (typeof row.data !== "string") {
		diagnostics.push(
			diagnostic(
				"invalid-revision-data",
				source,
				"The revision data is not a JSON object.",
			),
		);
		return undefined;
	}

	try {
		const parsed = JSON.parse(row.data);
		if (isRecord(parsed)) return parsed;
	} catch {
		// Report the same safe diagnostic for every invalid representation.
	}

	diagnostics.push(
		diagnostic(
			"invalid-revision-data",
			source,
			"The revision data is not a valid JSON object.",
		),
	);
	return undefined;
}

function mediaIndexes(rows) {
	const byId = new Map();
	const byStorageKey = new Map();

	for (const row of rows) {
		if (!isRecord(row)) continue;

		const id = asString(row.id);
		const storageKey = asString(row.storage_key ?? row.storageKey);
		if (id) byId.set(id, row);
		if (storageKey) byStorageKey.set(storageKey.replace(/^\/+/, ""), row);
	}

	return { byId, byStorageKey };
}

function safeUrl(value) {
	const source = asString(value);
	if (!source) return undefined;

	try {
		const parsed = new URL(source, "https://local.invalid");
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return undefined;
		}
		return {
			source,
			hostname:
				parsed.hostname === "local.invalid"
					? undefined
					: parsed.hostname.toLowerCase(),
			pathname: parsed.pathname,
			isRelative: parsed.hostname === "local.invalid",
		};
	} catch {
		return undefined;
	}
}

function mediaStorageCandidates(node) {
	const asset = isRecord(node.asset) ? node.asset : {};
	const meta = isRecord(asset.meta) ? asset.meta : {};
	const candidates = new Set();

	const metaStorageKey = asString(meta.storageKey ?? meta.storage_key);
	if (metaStorageKey) candidates.add(metaStorageKey.replace(/^\/+/, ""));

	for (const value of [asset.url, node.id, node.url]) {
		const parsed = safeUrl(value);
		if (!parsed) continue;

		const internalMatch = parsed.pathname.match(
			/^\/_emdash\/api\/media\/file\/(.+)$/,
		);
		if (internalMatch) {
			candidates.add(safelyDecode(internalMatch[1]).replace(/^\/+/, ""));
		}

		const wordpressMarker = "/wp-content/uploads/";
		const wordpressIndex = parsed.pathname.indexOf(wordpressMarker);
		if (wordpressIndex !== -1) {
			candidates.add(
				parsed.pathname
					.slice(wordpressIndex + 1)
					.replace(/^\/+/, "")
					.replaceAll("%20", " "),
			);
		}
	}

	return candidates;
}

function inspectMedia(node, indexes) {
	const asset = isRecord(node.asset) ? node.asset : {};
	const assetRef = asString(asset._ref);
	const source =
		safeUrl(asset.url) ?? safeUrl(node.id) ?? safeUrl(node.url) ?? undefined;
	let mediaRow;

	if (assetRef) {
		mediaRow =
			indexes.byId.get(assetRef) ??
			indexes.byStorageKey.get(safelyDecode(assetRef).replace(/^\/+/, ""));
	}
	if (!mediaRow) {
		for (const candidate of mediaStorageCandidates(node)) {
			mediaRow =
				indexes.byId.get(candidate) ??
				indexes.byStorageKey.get(candidate) ??
				indexes.byStorageKey.get(safelyDecode(candidate));
			if (mediaRow) break;
		}
	}

	let resolution = "unresolved";
	if (mediaRow) {
		resolution = "media-row";
	} else if (assetRef && source) {
		resolution = "embedded-asset";
	} else if (source && !source.isRelative) {
		resolution = "external";
	}

	const hasNativeAsset = Boolean(assetRef);
	const needsNormalization = !hasNativeAsset;

	return {
		resolution,
		needsNormalization,
		hostname: source?.hostname,
	};
}

function imageFeatures(node) {
	const asset = isRecord(node.asset) ? node.asset : {};
	const meta = isRecord(asset.meta) ? asset.meta : {};
	const features = [];

	if (hasValue(node.align)) features.push("alignment");
	if (hasValue(node.href)) features.push("link");
	if (hasValue(node.shape)) features.push("shape");
	if (hasValue(node.caption)) features.push("caption");
	if (hasValue(node.width) || hasValue(node.height))
		features.push("dimensions");
	if (hasValue(node.displayWidth) || hasValue(node.displayHeight)) {
		features.push("display-dimensions");
	}
	if (hasValue(meta.storageKey ?? meta.storage_key)) {
		features.push("asset-storage-key");
	}

	const source = safeUrl(asset.url) ?? safeUrl(node.id) ?? safeUrl(node.url);
	if (source?.pathname.startsWith("/_emdash/api/media/file/")) {
		features.push("internal-media-url");
	}
	if (source?.pathname.includes("/wp-content/uploads/")) {
		features.push("wordpress-media-url");
	}

	return features.sort();
}

function classifyImage(node, indexes) {
	const media = inspectMedia(node, indexes);
	const blockers = [];
	const features = imageFeatures(node);

	if (hasValue(node.href)) blockers.push("linked-image");
	if (hasValue(node.shape)) blockers.push("image-shape");
	if (media.resolution === "unresolved") blockers.push("unresolved-media");

	let classification = "native-ready";
	if (blockers.length) {
		classification = "blocked";
	} else if (media.needsNormalization) {
		classification = "native-ready-after-media-normalization";
	}

	return {
		type: node._type,
		targetType: "image",
		classification,
		blockers: blockers.sort(),
		features,
		mediaResolution: media.resolution,
		...(media.hostname ? { hostname: media.hostname } : {}),
	};
}

function classifyGallery(node, indexes) {
	const images = Array.isArray(node.images) ? node.images.filter(isRecord) : [];
	const media = images.map((image) => inspectMedia(image, indexes));
	const blockers = new Set();
	const features = [];
	const layout = asString(node.layout);

	if (layout) {
		blockers.add("legacy-layout");
		blockers.add("linked-images");
		features.push(`layout:${layout}`);
	}
	if (hasValue(node.align)) {
		blockers.add("gallery-alignment");
		features.push("alignment");
	}
	if (hasValue(node.caption)) {
		blockers.add("gallery-caption");
		features.push("caption");
	}
	if (images.some((image) => hasValue(image.href))) {
		blockers.add("linked-images");
		features.push("linked-images");
	}
	if (images.some((image) => hasValue(image.shape))) {
		blockers.add("image-shape");
		features.push("image-shape");
	}
	if (media.some((item) => item.resolution === "unresolved")) {
		blockers.add("unresolved-media");
	}

	let classification = "native-ready";
	if (blockers.size) {
		classification = "blocked";
	} else if (media.some((item) => item.needsNormalization)) {
		classification = "native-ready-after-media-normalization";
	}

	return {
		type: "gallery",
		targetType: "gallery",
		classification,
		blockers: [...blockers].sort(),
		features: features.sort(),
		imageCount: images.length,
	};
}

function embedProvider(node) {
	const explicitProvider = asString(node.provider)?.toLowerCase();
	const source =
		asString(node.url) ?? asString(node.embedUrl) ?? asString(node.id);
	const parsed = safeUrl(source);
	const hostname = parsed?.hostname;

	if (
		hostname &&
		(hostname === "youtu.be" ||
			hostname.endsWith("youtube.com") ||
			hostname.endsWith("youtube-nocookie.com"))
	) {
		return { provider: "youtube", hostname, source };
	}
	if (
		hostname &&
		(hostname === "vimeo.com" || hostname.endsWith(".vimeo.com"))
	) {
		return { provider: "vimeo", hostname, source };
	}
	if (
		hostname &&
		(hostname === "animoto.com" || hostname.endsWith(".animoto.com"))
	) {
		return { provider: "animoto", hostname, source };
	}

	return {
		provider: explicitProvider,
		hostname,
		source,
	};
}

function classifyLegacyEmbed(node) {
	const { provider, hostname, source } = embedProvider(node);
	const blockers = [];
	let classification = "blocked";
	let targetType;

	if ((provider === "youtube" || provider === "vimeo") && source) {
		classification = "native-ready";
		targetType = provider;
	} else if (!source) {
		blockers.push("missing-embed-source");
	} else if (provider === "animoto") {
		blockers.push("unsupported-provider");
	} else {
		blockers.push("unknown-provider");
	}

	return {
		type: "legacyEmbed",
		...(targetType ? { targetType } : {}),
		classification,
		blockers,
		features: provider ? [`provider:${provider}`] : [],
		...(provider ? { provider } : {}),
		...(hostname ? { hostname } : {}),
	};
}

function classifyLegacyVideo(node) {
	const source = safeUrl(node.url ?? node.id);
	const blockers = new Set(["editor-support"]);
	const features = [];

	if (!source) blockers.add("missing-or-unsafe-video-source");
	if (hasValue(node.title)) features.push("title");
	if (hasValue(node.mimeType ?? node.mime_type)) features.push("mime-type");
	if (hasValue(node.width) || hasValue(node.height))
		features.push("dimensions");
	if (features.length) blockers.add("metadata-parity");

	return {
		type: "legacyVideo",
		targetType: "embed",
		classification: "blocked",
		blockers: [...blockers].sort(),
		features: features.sort(),
		...(source?.hostname ? { hostname: source.hostname } : {}),
	};
}

function classifyNode(node, indexes) {
	switch (node._type) {
		case "legacyImage":
		case "image":
			return classifyImage(node, indexes);
		case "gallery":
			return classifyGallery(node, indexes);
		case "legacyEmbed":
			return classifyLegacyEmbed(node);
		case "legacyVideo":
			return classifyLegacyVideo(node);
		case "legacyPageList":
			return {
				type: "legacyPageList",
				classification: "site-specific",
				blockers: ["dynamic-content-query"],
				features: [],
			};
		case "youtube":
		case "vimeo":
		case "embed":
			return {
				type: node._type,
				classification: "native",
				blockers: [],
				features: [],
			};
		case "numberedHeading":
			return {
				type: "numberedHeading",
				targetType: "block",
				classification: "content-transform-candidate",
				blockers: [],
				features: [],
			};
		case "block": {
			if (
				node.listItem === "number" &&
				typeof node.style === "string" &&
				/^h[1-6]$/.test(node.style)
			) {
				return {
					type: "numberedHeadingPattern",
					targetType: "block",
					classification: "content-transform-candidate",
					blockers: [],
					features: [`style:${node.style}`],
				};
			}
			return undefined;
		}
		default:
			return undefined;
	}
}

function visitNodes(value, blockPath, callback) {
	if (Array.isArray(value)) {
		value.forEach((item, index) =>
			visitNodes(item, `${blockPath}[${index}]`, callback),
		);
		return;
	}
	if (!isRecord(value)) return;

	callback(value, blockPath);
	for (const [key, child] of Object.entries(value).sort(([left], [right]) =>
		left.localeCompare(right),
	)) {
		if (key === "children" || key === "markDefs") continue;
		if (Array.isArray(child) || isRecord(child)) {
			visitNodes(child, `${blockPath}.${key}`, callback);
		}
	}
}

function portableTextFields(tables, diagnostics) {
	const collectionRows = Array.isArray(tables._emdash_collections)
		? tables._emdash_collections
		: [];
	const fieldRows = Array.isArray(tables._emdash_fields)
		? tables._emdash_fields
		: [];
	const collectionById = new Map();

	for (const row of collectionRows) {
		if (!isRecord(row)) continue;
		const id = asString(row.id);
		const slug = asString(row.slug);
		if (id && slug) collectionById.set(id, slug);
	}

	const result = new Map();
	for (const row of fieldRows) {
		if (!isRecord(row) || row.type !== "portableText") continue;

		const collectionId = asString(row.collection_id ?? row.collectionId);
		const collection =
			(collectionId ? collectionById.get(collectionId) : undefined) ??
			asString(row.collection);
		const field = asString(row.slug);
		if (!collection || !field) {
			diagnostics.push({
				code: "unresolved-portable-text-field",
				sourceKind: "schema",
				collection: collection ?? "unknown",
				entryId: "n/a",
				field: field ?? "unknown",
				message:
					"A Portable Text schema field could not be associated with a collection.",
			});
			continue;
		}

		const fields = result.get(collection) ?? [];
		fields.push(field);
		result.set(collection, fields);
	}

	for (const [collection, fields] of result) {
		result.set(collection, [...new Set(fields)].sort());
	}

	return new Map(
		[...result].sort(([left], [right]) => left.localeCompare(right)),
	);
}

function summarize(occurrences, sourceCounts) {
	const byType = {};
	const byCollection = {};
	const media = {
		references: 0,
		resolved: 0,
		external: 0,
		unresolved: 0,
	};

	for (const occurrence of occurrences) {
		const typeSummary = (byType[occurrence.type] ??= {
			total: 0,
			classifications: {},
			blockers: {},
		});
		typeSummary.total += 1;
		typeSummary.classifications[occurrence.classification] =
			(typeSummary.classifications[occurrence.classification] ?? 0) + 1;
		for (const blocker of occurrence.blockers) {
			typeSummary.blockers[blocker] = (typeSummary.blockers[blocker] ?? 0) + 1;
		}

		const collectionSummary = (byCollection[occurrence.collection] ??= {});
		collectionSummary[occurrence.type] =
			(collectionSummary[occurrence.type] ?? 0) + 1;

		if (occurrence.mediaResolution) {
			media.references += 1;
			if (
				occurrence.mediaResolution === "media-row" ||
				occurrence.mediaResolution === "embedded-asset"
			) {
				media.resolved += 1;
			} else if (occurrence.mediaResolution === "external") {
				media.external += 1;
			} else {
				media.unresolved += 1;
			}
		}
	}

	for (const summary of Object.values(byType)) {
		summary.classifications = sortedRecord(summary.classifications);
		summary.blockers = sortedRecord(summary.blockers);
	}
	for (const [collection, counts] of Object.entries(byCollection)) {
		byCollection[collection] = sortedRecord(counts);
	}

	return {
		sources: sourceCounts,
		trackedOccurrences: occurrences.length,
		media,
		byType: sortedRecord(byType),
		byCollection: sortedRecord(byCollection),
	};
}

export function inventoryBackup(backup) {
	if (!isRecord(backup)) {
		throw new Error("The input must contain a JSON object.");
	}
	if (backup.format !== "emdash-backup") {
		throw new Error("The input is not an EmDash backup.");
	}
	if (backup.formatVersion !== 1) {
		throw new Error(
			`Unsupported EmDash backup format version: ${String(backup.formatVersion ?? "missing")}.`,
		);
	}
	if (!isRecord(backup.tables)) {
		throw new Error("The EmDash backup does not contain a tables object.");
	}

	const diagnostics = [];
	const tables = backup.tables;
	const fieldsByCollection = portableTextFields(tables, diagnostics);
	const indexes = mediaIndexes(Array.isArray(tables.media) ? tables.media : []);
	const contentLookup = new Map();
	const occurrences = [];
	const sourceCounts = {
		contentRows: 0,
		contentRowsByState: {},
		revisionRows: 0,
		portableTextValues: 0,
		invalidPortableTextValues: 0,
	};

	const inspectValue = (value, source) => {
		const diagnosticCount = diagnostics.length;
		const portableText = parsePortableText(value, source, diagnostics);
		if (!portableText) {
			if (diagnostics.length > diagnosticCount) {
				sourceCounts.invalidPortableTextValues += 1;
			}
			return;
		}

		sourceCounts.portableTextValues += 1;
		visitNodes(portableText, "$", (node, blockPath) => {
			const classified = classifyNode(node, indexes);
			if (!classified) return;
			occurrences.push({
				...source,
				blockPath,
				...classified,
			});
		});
	};

	for (const [collection, fields] of fieldsByCollection) {
		const rows = Array.isArray(tables[`ec_${collection}`])
			? tables[`ec_${collection}`].filter(isRecord)
			: [];
		rows.sort((left, right) => compareValues(left.id, right.id));
		sourceCounts.contentRows += rows.length;

		for (const row of rows) {
			const state = hasValue(row.deleted_at ?? row.deletedAt)
				? "trashed"
				: (asString(row.status) ?? "unknown");
			sourceCounts.contentRowsByState[state] =
				(sourceCounts.contentRowsByState[state] ?? 0) + 1;
			contentLookup.set(`${collection}:${row.id}`, row);
			for (const field of fields) {
				const source = makeSource(row, collection, field, "content", row);
				inspectValue(row[field], source);
			}
		}
	}

	const revisions = Array.isArray(tables.revisions)
		? tables.revisions.filter(isRecord)
		: [];
	revisions.sort(
		(left, right) =>
			compareValues(left.collection, right.collection) ||
			compareValues(
				left.entry_id ?? left.entryId,
				right.entry_id ?? right.entryId,
			) ||
			compareValues(left.id, right.id),
	);
	sourceCounts.revisionRows = revisions.length;

	for (const row of revisions) {
		const collection = asString(row.collection);
		const fields = collection ? fieldsByCollection.get(collection) : undefined;
		if (!collection || !fields) continue;

		const revisionData = parseRevisionData(row, diagnostics);
		if (!revisionData) continue;
		const entryId = row.entry_id ?? row.entryId;
		const contentRow = contentLookup.get(`${collection}:${entryId}`);

		for (const field of fields) {
			const source = makeSource(row, collection, field, "revision", contentRow);
			inspectValue(revisionData[field], source);
		}
	}

	occurrences.sort(compareOccurrences);
	diagnostics.sort(
		(left, right) =>
			compareValues(left.collection, right.collection) ||
			compareValues(left.entryId, right.entryId) ||
			compareValues(left.sourceKind, right.sourceKind) ||
			compareValues(left.revisionId, right.revisionId) ||
			compareValues(left.field, right.field) ||
			compareValues(left.code, right.code),
	);

	const portableTextSchema = Object.fromEntries(fieldsByCollection);
	sourceCounts.contentRowsByState = sortedRecord(
		sourceCounts.contentRowsByState,
	);
	const summary = summarize(occurrences, sourceCounts);
	summary.sources.invalidPortableTextValues = diagnostics.filter(
		(item) =>
			item.code === "invalid-portable-text-json" ||
			item.code === "invalid-portable-text-value",
	).length;

	return {
		format: INVENTORY_FORMAT,
		formatVersion: INVENTORY_FORMAT_VERSION,
		source: {
			format: backup.format,
			formatVersion: backup.formatVersion ?? null,
			emdashVersion: backup.emdashVersion ?? null,
			generatedAt: backup.generatedAt ?? null,
		},
		portableTextSchema,
		summary,
		diagnostics,
		occurrences,
	};
}

function formatCounts(record) {
	const entries = Object.entries(record);
	return entries.length
		? entries.map(([name, count]) => `${name}=${count}`).join(", ")
		: "none";
}

export function formatHumanInventory(inventory) {
	const lines = [
		"Legacy content inventory",
		`Backup: EmDash ${inventory.source.emdashVersion ?? "unknown"}, generated ${inventory.source.generatedAt ?? "unknown"}`,
		"",
		"Portable Text schema:",
	];

	for (const [collection, fields] of Object.entries(
		inventory.portableTextSchema,
	)) {
		lines.push(`- ${collection}: ${fields.join(", ")}`);
	}
	if (!Object.keys(inventory.portableTextSchema).length) lines.push("- none");

	const sources = inventory.summary.sources;
	lines.push(
		"",
		`Sources: ${sources.contentRows} content rows, ${sources.revisionRows} revisions, ${sources.portableTextValues} Portable Text values`,
		`Content states: ${formatCounts(sources.contentRowsByState)}`,
		`Tracked occurrences: ${inventory.summary.trackedOccurrences}`,
		"",
		"Types:",
	);

	for (const [type, summary] of Object.entries(inventory.summary.byType)) {
		lines.push(
			`- ${type}: ${summary.total} (${formatCounts(summary.classifications)})`,
		);
		if (Object.keys(summary.blockers).length) {
			lines.push(`  blockers: ${formatCounts(summary.blockers)}`);
		}
	}
	if (!Object.keys(inventory.summary.byType).length) lines.push("- none");

	const media = inventory.summary.media;
	lines.push(
		"",
		`Media references: ${media.references} total, ${media.resolved} resolved, ${media.external} external, ${media.unresolved} unresolved`,
		`Diagnostics: ${inventory.diagnostics.length}`,
	);

	if (inventory.diagnostics.length) {
		lines.push("", "Diagnostics:");
		for (const item of inventory.diagnostics) {
			const revision = item.revisionId ? ` revision=${item.revisionId}` : "";
			lines.push(
				`- ${item.code}: ${item.collection}:${item.entryId}${revision} field=${item.field}`,
			);
		}
	}

	lines.push("", "Sample occurrences:");
	for (const occurrence of inventory.occurrences.slice(0, 12)) {
		const revision = occurrence.revisionId
			? ` revision=${occurrence.revisionId}`
			: "";
		lines.push(
			`- ${occurrence.type}/${occurrence.classification}: ${occurrence.collection}:${occurrence.entryId}${revision} ${occurrence.field}${occurrence.blockPath}`,
		);
	}
	if (!inventory.occurrences.length) lines.push("- none");

	return `${lines.join("\n")}\n`;
}

function parseArguments(args) {
	let input;
	let json = false;
	let help = false;

	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--") {
			continue;
		} else if (argument === "--input") {
			input = args[index + 1];
			index += 1;
			if (!input) throw new Error("--input requires a file path.");
		} else if (argument === "--json") {
			json = true;
		} else if (argument === "--help" || argument === "-h") {
			help = true;
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}

	if (!help && !input) throw new Error("--input is required.");
	return { input, json, help };
}

async function main() {
	try {
		const options = parseArguments(process.argv.slice(2));
		if (options.help) {
			process.stdout.write(`${usage}\n`);
			return;
		}

		let backup;
		try {
			backup = JSON.parse(await readFile(options.input, "utf8"));
		} catch (error) {
			throw new Error(
				`Could not read a valid JSON backup: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}

		const inventory = inventoryBackup(backup);
		process.stdout.write(
			options.json
				? `${JSON.stringify(inventory, null, 2)}\n`
				: formatHumanInventory(inventory),
		);
	} catch (error) {
		process.stderr.write(
			`Error: ${error instanceof Error ? error.message : String(error)}\n\n${usage}\n`,
		);
		process.exitCode = 1;
	}
}

const invokedAsScript =
	process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedAsScript) await main();
