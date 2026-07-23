import { inventoryBackup } from "../audit-legacy-content.mjs";

const REPORT_FORMAT = "engaged-philosophy-legacy-content-conversion-plan";
const REPORT_FORMAT_VERSION = 1;
const INTERNAL_MEDIA_PREFIX = "/_emdash/api/media/file/";

function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value) {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
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
			url: parsed,
			hostname:
				parsed.hostname === "local.invalid"
					? undefined
					: parsed.hostname.toLowerCase(),
			isRelative: parsed.hostname === "local.invalid",
		};
	} catch {
		return undefined;
	}
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

function mediaCandidates(node) {
	const asset = isRecord(node.asset) ? node.asset : {};
	const meta = isRecord(asset.meta) ? asset.meta : {};
	const candidates = new Set();

	const assetRef = asString(asset._ref);
	const storageKey = asString(meta.storageKey ?? meta.storage_key);
	if (assetRef) candidates.add(safelyDecode(assetRef).replace(/^\/+/, ""));
	if (storageKey) candidates.add(safelyDecode(storageKey).replace(/^\/+/, ""));

	for (const value of [asset.url, node.url, node.id]) {
		const parsed = safeUrl(value);
		if (!parsed) continue;

		if (parsed.url.pathname.startsWith(INTERNAL_MEDIA_PREFIX)) {
			candidates.add(
				safelyDecode(
					parsed.url.pathname.slice(INTERNAL_MEDIA_PREFIX.length),
				).replace(/^\/+/, ""),
			);
		}

		const marker = "/wp-content/uploads/";
		const index = parsed.url.pathname.indexOf(marker);
		if (index !== -1) {
			candidates.add(
				safelyDecode(parsed.url.pathname.slice(index + 1)).replace(/^\/+/, ""),
			);
		}
	}

	return candidates;
}

function findMediaRow(node, indexes) {
	for (const candidate of mediaCandidates(node)) {
		const row =
			indexes.byId.get(candidate) ?? indexes.byStorageKey.get(candidate);
		if (row) return row;
	}
	return undefined;
}

function mediaSource(node) {
	const asset = isRecord(node.asset) ? node.asset : {};
	return safeUrl(asset.url) ?? safeUrl(node.url) ?? safeUrl(node.id);
}

function normalizedAsset(node, indexes) {
	const originalAsset = isRecord(node.asset) ? node.asset : {};
	const assetRef = asString(originalAsset._ref);
	const source = mediaSource(node);

	if (assetRef) {
		return {
			...originalAsset,
			_ref: assetRef,
			...(source ? { url: source.source } : {}),
		};
	}

	const mediaRow = findMediaRow(node, indexes);
	if (mediaRow) {
		const id = asString(mediaRow.id);
		const storageKey = asString(mediaRow.storage_key ?? mediaRow.storageKey);
		if (!id) return undefined;
		return {
			...originalAsset,
			_ref: id,
			...(storageKey
				? { url: `${INTERNAL_MEDIA_PREFIX}${storageKey}` }
				: source
					? { url: source.source }
					: {}),
		};
	}

	if (source && !source.isRelative) {
		return {
			...originalAsset,
			_ref: source.source,
			url: source.source,
		};
	}

	return undefined;
}

function imageAlignment(node) {
	const alignment = asString(node.alignment) ?? asString(node.align);
	return ["left", "center", "right", "wide", "full"].includes(alignment)
		? alignment
		: undefined;
}

function convertImage(node, indexes) {
	if (hasValue(node.href)) {
		return { status: "blocked", blockers: ["linked-image"] };
	}
	if (hasValue(node.shape)) {
		return { status: "blocked", blockers: ["image-shape"] };
	}
	if (!asString(node._key)) {
		return { status: "blocked", blockers: ["missing-block-key"] };
	}

	const asset = normalizedAsset(node, indexes);
	if (!asset) {
		return { status: "blocked", blockers: ["unresolved-media"] };
	}

	const isLegacyImage = node._type === "legacyImage";
	const hasLegacyAlignment = hasValue(node.align);
	const hasLegacySource = hasValue(node.id) || hasValue(node.url);
	const hasNativeAsset = asString(
		isRecord(node.asset) ? node.asset._ref : undefined,
	);
	if (
		!isLegacyImage &&
		!hasLegacyAlignment &&
		!hasLegacySource &&
		hasNativeAsset
	) {
		return { status: "unchanged" };
	}

	const converted = {
		...node,
		_type: "image",
		asset,
	};
	delete converted.id;
	delete converted.url;
	delete converted.align;
	delete converted.href;
	delete converted.shape;

	const alignment = imageAlignment(node);
	if (alignment) {
		converted.alignment = alignment;
	} else {
		delete converted.alignment;
	}

	let operation = "image-media-normalization";
	if (isLegacyImage) {
		operation = "legacy-image-to-image";
	} else if (hasLegacyAlignment) {
		operation = "image-alignment-normalization";
	}

	return {
		status: "changed",
		operation,
		fromType: node._type,
		toType: "image",
		node: converted,
	};
}

function legacyEmbedSource(node) {
	return asString(node.embedUrl) ?? asString(node.url) ?? asString(node.id);
}

function legacyEmbedProvider(node, source) {
	const parsed = safeUrl(source);
	const hostname = parsed?.hostname;

	if (
		hostname === "youtu.be" ||
		hostname?.endsWith("youtube.com") ||
		hostname?.endsWith("youtube-nocookie.com")
	) {
		return "youtube";
	}
	if (hostname === "vimeo.com" || hostname?.endsWith(".vimeo.com")) {
		return "vimeo";
	}

	const explicit = asString(node.provider)?.toLowerCase();
	return explicit === "youtube" || explicit === "vimeo" ? explicit : undefined;
}

function youtubeId(source) {
	if (/^[A-Za-z0-9_-]{11}$/.test(source)) return source;

	const parsed = safeUrl(source);
	if (!parsed?.hostname) return undefined;
	if (
		parsed.hostname !== "youtu.be" &&
		!parsed.hostname.endsWith("youtube.com") &&
		!parsed.hostname.endsWith("youtube-nocookie.com")
	) {
		return undefined;
	}

	const candidate =
		parsed.url.searchParams.get("v") ??
		parsed.url.pathname.match(
			/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/,
		)?.[1] ??
		(parsed.hostname === "youtu.be"
			? parsed.url.pathname.match(/^\/([A-Za-z0-9_-]{11})/)?.[1]
			: undefined);
	return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate)
		? candidate
		: undefined;
}

function vimeoId(source) {
	if (/^\d{1,20}$/.test(source)) return source;

	const parsed = safeUrl(source);
	if (
		!parsed?.hostname ||
		(parsed.hostname !== "vimeo.com" && !parsed.hostname.endsWith(".vimeo.com"))
	) {
		return undefined;
	}

	return parsed.url.pathname.match(/\/(?:video\/)?(\d{1,20})(?:\/|$)/)?.[1];
}

function embedParams(source, provider) {
	const parsed = safeUrl(source);
	if (!parsed?.hostname) return undefined;

	const parameters = new URLSearchParams(parsed.url.searchParams);
	if (provider === "youtube") parameters.delete("v");
	const search = parameters.toString();
	const time = parsed.url.hash.match(/^#t=(.+)$/)?.[1];

	if (provider === "vimeo" && time) {
		return `${search}#t=${time}`;
	}
	return search || undefined;
}

function convertLegacyEmbed(node) {
	if (!asString(node._key)) {
		return { status: "blocked", blockers: ["missing-block-key"] };
	}

	const source = legacyEmbedSource(node);
	if (!source) {
		return { status: "blocked", blockers: ["missing-embed-source"] };
	}

	const provider = legacyEmbedProvider(node, source);
	const id =
		provider === "youtube"
			? youtubeId(source)
			: provider === "vimeo"
				? vimeoId(source)
				: undefined;
	if (!provider || !id) {
		return { status: "blocked", blockers: ["invalid-provider-source"] };
	}

	const converted = {
		_type: provider,
		_key: node._key,
		id,
	};
	const params = embedParams(source, provider);
	if (params) converted.params = params;

	const title = asString(node.title);
	if (provider === "youtube" && title) converted.title = title;
	if (provider === "vimeo" && title) converted.playlabel = title;

	return {
		status: "changed",
		operation: `legacy-embed-to-${provider}`,
		fromType: "legacyEmbed",
		toType: provider,
		node: converted,
	};
}

function pathTarget(root, blockPath) {
	if (!blockPath.startsWith("$")) return undefined;

	let current = root;
	let parent;
	let key;
	let offset = 1;

	while (offset < blockPath.length) {
		if (blockPath[offset] === "[") {
			const end = blockPath.indexOf("]", offset);
			if (end === -1) return undefined;
			const index = Number(blockPath.slice(offset + 1, end));
			if (!Number.isInteger(index) || !Array.isArray(current)) {
				return undefined;
			}
			parent = current;
			key = index;
			current = current[index];
			offset = end + 1;
			continue;
		}

		if (blockPath[offset] === ".") {
			const start = offset + 1;
			let end = start;
			while (
				end < blockPath.length &&
				blockPath[end] !== "." &&
				blockPath[end] !== "["
			) {
				end += 1;
			}
			const property = blockPath.slice(start, end);
			if (!property || !isRecord(current)) return undefined;
			parent = current;
			key = property;
			current = current[property];
			offset = end;
			continue;
		}

		return undefined;
	}

	return parent === undefined ? undefined : { parent, key, node: current };
}

function parseObject(value) {
	if (isRecord(value)) return { value, serialized: false };
	if (typeof value !== "string") return undefined;

	try {
		const parsed = JSON.parse(value);
		return isRecord(parsed) ? { value: parsed, serialized: true } : undefined;
	} catch {
		return undefined;
	}
}

function parseBlocks(value) {
	if (Array.isArray(value)) return { value, serialized: false };
	if (typeof value !== "string") return undefined;

	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed)
			? { value: parsed, serialized: true }
			: undefined;
	} catch {
		return undefined;
	}
}

function findRow(rows, id) {
	return rows.find(
		(row) => isRecord(row) && String(row.id ?? "") === String(id ?? ""),
	);
}

function updateOccurrence(backup, occurrence, convert) {
	const tables = backup.tables;
	if (!isRecord(tables)) return { status: "missing-source" };

	let owner;
	let revision;
	let revisionData;
	let revisionWasSerialized = false;

	if (occurrence.sourceKind === "revision") {
		const rows = Array.isArray(tables.revisions) ? tables.revisions : [];
		revision = findRow(rows, occurrence.revisionId);
		if (!revision) return { status: "missing-source" };

		const parsed = parseObject(revision.data);
		if (!parsed) return { status: "missing-source" };
		revisionData = parsed.value;
		revisionWasSerialized = parsed.serialized;
		owner = revisionData;
	} else {
		const rows = Array.isArray(tables[`ec_${occurrence.collection}`])
			? tables[`ec_${occurrence.collection}`]
			: [];
		owner = findRow(rows, occurrence.entryId);
	}

	if (!isRecord(owner)) return { status: "missing-source" };
	const parsedBlocks = parseBlocks(owner[occurrence.field]);
	if (!parsedBlocks) return { status: "missing-source" };

	const target = pathTarget(parsedBlocks.value, occurrence.blockPath);
	if (!target || !isRecord(target.node)) {
		return { status: "missing-source" };
	}

	const result = convert(target.node);
	if (result.status !== "changed") return result;

	target.parent[target.key] = result.node;
	owner[occurrence.field] = parsedBlocks.serialized
		? JSON.stringify(parsedBlocks.value)
		: parsedBlocks.value;

	if (revision && revisionData) {
		revision.data = revisionWasSerialized
			? JSON.stringify(revisionData)
			: revisionData;
	}

	return result;
}

function location(occurrence) {
	const result = {
		sourceKind: occurrence.sourceKind,
		collection: occurrence.collection,
		entryId: occurrence.entryId,
		field: occurrence.field,
		blockPath: occurrence.blockPath,
	};
	for (const key of ["revisionId", "status", "trashed", "slug", "entryPath"]) {
		if (occurrence[key] !== undefined) result[key] = occurrence[key];
	}
	return result;
}

function compareLocations(left, right) {
	for (const key of [
		"collection",
		"entryId",
		"sourceKind",
		"revisionId",
		"field",
		"blockPath",
		"type",
	]) {
		const comparison = String(left[key] ?? "").localeCompare(
			String(right[key] ?? ""),
			undefined,
			{ numeric: true },
		);
		if (comparison) return comparison;
	}
	return 0;
}

function summarizeChanges(changes, blocked, deferred) {
	const operations = {};
	const fields = new Set();

	for (const change of changes) {
		operations[change.operation] = (operations[change.operation] ?? 0) + 1;
		fields.add(
			[
				change.sourceKind,
				change.collection,
				change.entryId,
				change.revisionId ?? "",
				change.field,
			].join(":"),
		);
	}

	return {
		changedBlocks: changes.length,
		changedFields: fields.size,
		operations: sortedRecord(operations),
		blockedOccurrences: blocked.length,
		deferredOccurrences: deferred.length,
	};
}

export function convertBackup(backup) {
	const before = inventoryBackup(backup);
	const convertedBackup = structuredClone(backup);
	const tables = isRecord(convertedBackup.tables) ? convertedBackup.tables : {};
	const indexes = mediaIndexes(Array.isArray(tables.media) ? tables.media : []);
	const changes = [];
	const blocked = [];
	const deferred = [];
	const diagnostics = [...before.diagnostics];

	for (const occurrence of before.occurrences) {
		if (
			occurrence.classification === "blocked" ||
			occurrence.classification === "site-specific"
		) {
			blocked.push({
				...location(occurrence),
				type: occurrence.type,
				blockers: occurrence.blockers,
			});
			continue;
		}

		if (occurrence.classification === "content-transform-candidate") {
			deferred.push({
				...location(occurrence),
				type: occurrence.type,
				reason: "requires-content-design",
			});
			continue;
		}

		let result;
		if (occurrence.type === "legacyImage" || occurrence.type === "image") {
			result = updateOccurrence(convertedBackup, occurrence, (node) =>
				convertImage(node, indexes),
			);
		} else if (occurrence.type === "legacyEmbed") {
			result = updateOccurrence(
				convertedBackup,
				occurrence,
				convertLegacyEmbed,
			);
		} else {
			continue;
		}

		if (result.status === "changed") {
			changes.push({
				...location(occurrence),
				operation: result.operation,
				fromType: result.fromType,
				toType: result.toType,
			});
		} else if (result.status === "blocked") {
			blocked.push({
				...location(occurrence),
				type: occurrence.type,
				blockers: result.blockers,
			});
		} else if (result.status === "missing-source") {
			diagnostics.push({
				code: "conversion-source-not-found",
				...location(occurrence),
				message:
					"The inventoried block could not be found in the copied backup.",
			});
		}
	}

	changes.sort(compareLocations);
	blocked.sort(compareLocations);
	deferred.sort(compareLocations);
	diagnostics.sort(compareLocations);
	const after = inventoryBackup(convertedBackup);

	const report = {
		format: REPORT_FORMAT,
		formatVersion: REPORT_FORMAT_VERSION,
		source: before.source,
		summary: summarizeChanges(changes, blocked, deferred),
		before: {
			trackedOccurrences: before.summary.trackedOccurrences,
			byType: before.summary.byType,
		},
		after: {
			trackedOccurrences: after.summary.trackedOccurrences,
			byType: after.summary.byType,
		},
		changes,
		blocked,
		deferred,
		diagnostics,
	};

	return { backup: convertedBackup, report };
}

function formatCounts(record) {
	const entries = Object.entries(record);
	return entries.length
		? entries.map(([name, count]) => `${name}=${count}`).join(", ")
		: "none";
}

export function formatConversionPlan(report) {
	const lines = [
		"Legacy content conversion plan",
		`Backup: EmDash ${report.source.emdashVersion ?? "unknown"}, generated ${report.source.generatedAt ?? "unknown"}`,
		"",
		`Would change ${report.summary.changedBlocks} blocks in ${report.summary.changedFields} fields.`,
		`Operations: ${formatCounts(report.summary.operations)}`,
		`Blocked occurrences: ${report.summary.blockedOccurrences}`,
		`Deferred occurrences: ${report.summary.deferredOccurrences}`,
		`Diagnostics: ${report.diagnostics.length}`,
	];

	if (report.changes.length) {
		lines.push("", "Planned changes:");
		for (const change of report.changes.slice(0, 20)) {
			const revision = change.revisionId
				? ` revision=${change.revisionId}`
				: "";
			lines.push(
				`- ${change.operation}: ${change.collection}:${change.entryId}${revision} ${change.field}${change.blockPath}`,
			);
		}
	}

	if (report.blocked.length) {
		lines.push("", "Blocked samples:");
		for (const item of report.blocked.slice(0, 12)) {
			const revision = item.revisionId ? ` revision=${item.revisionId}` : "";
			lines.push(
				`- ${item.type}: ${item.collection}:${item.entryId}${revision} ${item.field}${item.blockPath} (${item.blockers.join(", ")})`,
			);
		}
	}

	lines.push("", "No backup or database was modified.");
	return `${lines.join("\n")}\n`;
}
