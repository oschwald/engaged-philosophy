import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { parseSeedPathArg, readSeedFile } from "./lib/migration-seed-path.mjs";

const ROOT = process.cwd();
const DATABASE_NAME = "engaged-philosophy";
const CHUNK_SIZE = 750_000;
const INSERT_BATCH_SIZE = 1;
const DEFAULT_LOCALE = "en";
const args = process.argv.slice(2);
const seedPath = parseSeedPathArg(args);
const mode = args.includes("--remote")
	? "--remote"
	: args.includes("--local")
		? "--local"
		: "--local";
const dryRun = args.includes("--dry-run");
const remoteConfirmed =
	args.includes("--confirm") &&
	args[args.indexOf("--confirm") + 1] === "remote";

if (mode === "--remote" && !dryRun && !remoteConfirmed) {
	console.error(
		"Refusing to overwrite remote D1 without --confirm remote. Use --dry-run to inspect remote counts without confirmation.",
	);
	process.exit(1);
}

const seed = readSeedFile(seedPath);

const COLLECTION_CONFIG = {
	pages: {
		table: "ec_pages",
		columns: [
			"id",
			"slug",
			"status",
			"author_id",
			"primary_byline_id",
			"created_at",
			"updated_at",
			"published_at",
			"scheduled_at",
			"deleted_at",
			"version",
			"live_revision_id",
			"draft_revision_id",
			"locale",
			"translation_group",
			"title",
			"path",
			"content",
			"featured_image",
			"template",
			"about_html",
			"box_left_title",
			"box_left_html",
			"box_middle_title",
			"box_middle_html",
			"box_right_title",
			"box_right_html",
			"author_name",
			"legacy_wp_id",
		],
	},
	posts: {
		table: "ec_posts",
		columns: [
			"id",
			"slug",
			"status",
			"author_id",
			"primary_byline_id",
			"created_at",
			"updated_at",
			"published_at",
			"scheduled_at",
			"deleted_at",
			"version",
			"live_revision_id",
			"draft_revision_id",
			"locale",
			"translation_group",
			"title",
			"path",
			"excerpt",
			"content",
			"featured_image",
			"published_on",
			"author_name",
			"legacy_wp_id",
		],
	},
	projects: {
		table: "ec_projects",
		columns: [
			"id",
			"slug",
			"status",
			"author_id",
			"primary_byline_id",
			"created_at",
			"updated_at",
			"published_at",
			"scheduled_at",
			"deleted_at",
			"version",
			"live_revision_id",
			"draft_revision_id",
			"locale",
			"translation_group",
			"title",
			"path",
			"excerpt",
			"content",
			"featured_image",
			"highlight",
			"menu_order",
			"published_on",
			"author_name",
			"legacy_wp_id",
		],
	},
};

function runWrangler(args) {
	const result = spawnSync(
		"npx",
		["wrangler", "d1", "execute", DATABASE_NAME, "--json", mode, ...args],
		{
			cwd: ROOT,
			encoding: "utf8",
			maxBuffer: 32 * 1024 * 1024,
		},
	);

	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(
			result.stderr || result.stdout || "wrangler d1 execute failed",
		);
	}

	return result.stdout;
}

function executeQuery(command) {
	const raw = runWrangler(["--command", command]).trim();
	if (!raw) return [];
	const parsed = JSON.parse(raw);
	if (!Array.isArray(parsed) || parsed.length === 0) return [];
	return parsed[0]?.results ?? [];
}

function escapeSqlString(value) {
	return value.replaceAll("'", "''");
}

function sqlValue(value) {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "number")
		return Number.isFinite(value) ? String(value) : "NULL";
	if (typeof value === "boolean") return value ? "1" : "0";
	if (typeof value === "object") {
		return `'${escapeSqlString(JSON.stringify(value))}'`;
	}
	return `'${escapeSqlString(String(value))}'`;
}

function chunkStatements(statements) {
	const chunks = [];
	let current = [];
	let size = 0;

	for (const statement of statements) {
		const nextSize = size + statement.length + 1;
		if (current.length > 0 && nextSize > CHUNK_SIZE) {
			chunks.push(current);
			current = [];
			size = 0;
		}
		current.push(statement);
		size += statement.length + 1;
	}

	if (current.length > 0) {
		chunks.push(current);
	}

	return chunks;
}

function runStatementChunks(statements, label) {
	if (statements.length === 0) return;

	const chunks = chunkStatements(statements);

	for (const [index, chunk] of chunks.entries()) {
		const sqlPath = path.join(
			os.tmpdir(),
			`engaged-philosophy-${label}-${index + 1}-${Date.now()}.sql`,
		);
		fs.writeFileSync(sqlPath, `${chunk.join("\n")}\n`);

		try {
			runWrangler(["--file", sqlPath]);
		} finally {
			fs.unlinkSync(sqlPath);
		}
	}
}

function contentStatus(entry) {
	return entry.status === "draft" ? "draft" : "published";
}

function rowTimestamp(entry) {
	if (typeof entry.data?.published_on === "string" && entry.data.published_on) {
		return entry.data.published_on;
	}
	return "2026-05-26T00:00:00Z";
}

function revisionIdFor(entry) {
	return `${entry.id}:rev`;
}

function translationGroupFor(entry, idMap) {
	if (entry.translationOf && idMap.has(entry.translationOf)) {
		return idMap.get(entry.translationOf);
	}
	return entry.id;
}

function buildContentRow(collection, entry, translationGroup) {
	const timestamp = rowTimestamp(entry);
	const status = contentStatus(entry);
	const revisionId = revisionIdFor(entry);
	const row = {
		id: entry.id,
		slug: entry.slug,
		status,
		author_id: null,
		primary_byline_id: null,
		created_at: timestamp,
		updated_at: timestamp,
		published_at: status === "published" ? timestamp : null,
		scheduled_at: null,
		deleted_at: null,
		version: 1,
		live_revision_id: status === "published" ? revisionId : null,
		draft_revision_id: status === "draft" ? revisionId : null,
		locale: entry.locale ?? DEFAULT_LOCALE,
		translation_group: translationGroup,
		...entry.data,
	};

	return COLLECTION_CONFIG[collection].columns.map(
		(column) => row[column] ?? null,
	);
}

function buildInsert(table, columns, rows) {
	const values = rows
		.map((row) => `(${row.map((value) => sqlValue(value)).join(", ")})`)
		.join(",\n");

	return `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${values};`;
}

function buildInsertBatches(
	table,
	columns,
	rows,
	batchSize = INSERT_BATCH_SIZE,
) {
	const statements = [];

	for (let index = 0; index < rows.length; index += batchSize) {
		statements.push(
			buildInsert(table, columns, rows.slice(index, index + batchSize)),
		);
	}

	return statements;
}

function flattenMenuItems(items, parentId = null, prefix = []) {
	const flattened = [];

	for (const [index, item] of items.entries()) {
		const pathKey = [...prefix, index + 1].join("-");
		const id = item.id ?? `menu-item:${pathKey}`;
		flattened.push({ ...item, id, parentId, pathKey });
		if (Array.isArray(item.children) && item.children.length > 0) {
			flattened.push(
				...flattenMenuItems(item.children, id, [...prefix, index + 1]),
			);
		}
	}

	return flattened;
}

function currentSummary() {
	const counts = executeQuery(
		"SELECT 'pages' AS collection, COUNT(*) AS count FROM ec_pages UNION ALL SELECT 'posts', COUNT(*) FROM ec_posts UNION ALL SELECT 'projects', COUNT(*) FROM ec_projects;",
	);
	const termCount = executeQuery(
		`SELECT COUNT(*) AS count FROM taxonomies WHERE name IN (${seed.taxonomies.map((taxonomy) => sqlValue(taxonomy.name)).join(", ")});`,
	)[0]?.count;
	const menuCount = executeQuery(
		`SELECT COUNT(*) AS count FROM _emdash_menu_items WHERE menu_id IN (SELECT id FROM _emdash_menus WHERE name IN (${seed.menus.map((menu) => sqlValue(menu.name)).join(", ")}));`,
	)[0]?.count;

	return { counts, termCount, menuCount };
}

function expectedSummary() {
	const content = Object.fromEntries(
		Object.entries(seed.content ?? {}).map(([collection, entries]) => [
			collection,
			entries.length,
		]),
	);
	const termCount = (seed.taxonomies ?? []).reduce(
		(total, taxonomy) => total + (taxonomy.terms?.length ?? 0),
		0,
	);
	const menuCount = (seed.menus ?? []).reduce((total, menu) => {
		const countItems = (items) =>
			items.reduce((sum, item) => sum + 1 + countItems(item.children ?? []), 0);
		return total + countItems(menu.items ?? []);
	}, 0);

	return { content, termCount, menuCount };
}

const before = currentSummary();
const expected = expectedSummary();

console.log(
	JSON.stringify(
		{
			mode: mode.slice(2),
			dryRun,
			seedPath: path.relative(ROOT, seedPath),
			before,
			expected,
		},
		null,
		2,
	),
);

if (dryRun) {
	process.exit(0);
}

const contentIdMap = new Map();
for (const [collection, entries] of Object.entries(seed.content ?? {})) {
	for (const entry of entries) {
		contentIdMap.set(`${collection}:${entry.id}`, entry.id);
	}
}

const taxonomyDefStatements = [];
const taxonomyTermStatements = [];
const taxonomyIdMap = new Map();

for (const taxonomy of seed.taxonomies ?? []) {
	const locale = taxonomy.locale ?? DEFAULT_LOCALE;
	const defId = taxonomy.id ?? `taxonomy-def:${taxonomy.name}:${locale}`;
	const translationGroup = taxonomy.translationOf
		? `${taxonomy.translationOf}:${locale}`
		: defId;

	taxonomyDefStatements.push(
		`INSERT INTO _emdash_taxonomy_defs (id, name, label, label_singular, hierarchical, collections, locale, translation_group) VALUES (${sqlValue(defId)}, ${sqlValue(taxonomy.name)}, ${sqlValue(taxonomy.label)}, ${sqlValue(taxonomy.labelSingular ?? null)}, ${sqlValue(taxonomy.hierarchical)}, ${sqlValue(JSON.stringify(taxonomy.collections ?? []))}, ${sqlValue(locale)}, ${sqlValue(translationGroup)});`,
	);

	for (const term of taxonomy.terms ?? []) {
		const termLocale = term.locale ?? locale;
		const termId =
			term.id ?? `taxonomy:${taxonomy.name}:${term.slug}:${termLocale}`;
		taxonomyIdMap.set(`${taxonomy.name}:${term.slug}:${termLocale}`, termId);
	}
}

for (const taxonomy of seed.taxonomies ?? []) {
	const locale = taxonomy.locale ?? DEFAULT_LOCALE;
	for (const term of taxonomy.terms ?? []) {
		const termLocale = term.locale ?? locale;
		const termId =
			term.id ?? `taxonomy:${taxonomy.name}:${term.slug}:${termLocale}`;
		const parentId = term.parent
			? (taxonomyIdMap.get(`${taxonomy.name}:${term.parent}:${termLocale}`) ??
				null)
			: null;
		const translationGroup = term.translationOf ? term.translationOf : termId;
		const data = term.description ? { description: term.description } : null;

		taxonomyTermStatements.push(
			`INSERT INTO taxonomies (id, name, slug, label, parent_id, data, locale, translation_group) VALUES (${sqlValue(termId)}, ${sqlValue(taxonomy.name)}, ${sqlValue(term.slug)}, ${sqlValue(term.label)}, ${sqlValue(parentId)}, ${sqlValue(data)}, ${sqlValue(termLocale)}, ${sqlValue(translationGroup)});`,
		);
	}
}

const contentStatements = [];
const revisionStatements = [];
const contentTaxonomyStatements = [];

for (const [collection, entries] of Object.entries(seed.content ?? {})) {
	const config = COLLECTION_CONFIG[collection];
	if (!config) continue;

	const translationGroups = new Map();
	for (const entry of entries) {
		translationGroups.set(entry.id, entry.id);
	}

	const rows = entries.map((entry) =>
		buildContentRow(
			collection,
			entry,
			translationGroupFor(entry, translationGroups),
		),
	);
	contentStatements.push(
		...buildInsertBatches(config.table, config.columns, rows),
	);

	const revisionRows = entries.map((entry) => [
		revisionIdFor(entry),
		collection,
		entry.id,
		JSON.stringify(entry.data ?? {}),
		null,
		rowTimestamp(entry),
	]);

	revisionStatements.push(
		...buildInsertBatches(
			"revisions",
			["id", "collection", "entry_id", "data", "author_id", "created_at"],
			revisionRows,
		),
	);

	for (const entry of entries) {
		const locale = entry.locale ?? DEFAULT_LOCALE;
		for (const [taxonomyName, slugs] of Object.entries(
			entry.taxonomies ?? {},
		)) {
			for (const slug of slugs) {
				const taxonomyId =
					taxonomyIdMap.get(`${taxonomyName}:${slug}:${locale}`) ??
					taxonomyIdMap.get(`${taxonomyName}:${slug}:${DEFAULT_LOCALE}`);
				if (!taxonomyId) {
					throw new Error(
						`Missing taxonomy term for ${collection}:${entry.slug} -> ${taxonomyName}:${slug}`,
					);
				}
				contentTaxonomyStatements.push(
					`INSERT INTO content_taxonomies (collection, entry_id, taxonomy_id) VALUES (${sqlValue(collection)}, ${sqlValue(entry.id)}, ${sqlValue(taxonomyId)});`,
				);
			}
		}
	}
}

const menuStatements = [];
for (const menu of seed.menus ?? []) {
	const locale = menu.locale ?? DEFAULT_LOCALE;
	const menuId = menu.id ?? `menu:${menu.name}:${locale}`;
	const translationGroup = menu.translationOf ?? menuId;
	menuStatements.push(
		`INSERT INTO _emdash_menus (id, name, label, locale, translation_group) VALUES (${sqlValue(menuId)}, ${sqlValue(menu.name)}, ${sqlValue(menu.label)}, ${sqlValue(locale)}, ${sqlValue(translationGroup)});`,
	);

	const flatItems = flattenMenuItems(menu.items ?? []);
	for (const item of flatItems) {
		menuStatements.push(
			`INSERT INTO _emdash_menu_items (id, menu_id, parent_id, sort_order, type, reference_collection, reference_id, custom_url, label, title_attr, target, css_classes, locale, translation_group) VALUES (${sqlValue(item.id)}, ${sqlValue(menuId)}, ${sqlValue(item.parentId)}, ${sqlValue(Number(item.pathKey.split("-").at(-1)) - 1)}, ${sqlValue(item.type ?? "custom")}, ${sqlValue(item.collection ?? null)}, ${sqlValue(item.ref ? (contentIdMap.get(`${item.collection}:${item.ref}`) ?? item.ref) : null)}, ${sqlValue(item.url ?? null)}, ${sqlValue(item.label ?? "")}, ${sqlValue(item.titleAttr ?? null)}, ${sqlValue(item.target ?? null)}, ${sqlValue(item.cssClasses ?? null)}, ${sqlValue(item.locale ?? locale)}, ${sqlValue(item.translationOf ?? item.id)});`,
		);
	}
}

const cleanupStatements = [
	"PRAGMA foreign_keys = OFF;",
	`DELETE FROM content_taxonomies WHERE collection IN ('pages', 'posts', 'projects');`,
	"DELETE FROM ec_pages;",
	"DELETE FROM ec_posts;",
	"DELETE FROM ec_projects;",
	`DELETE FROM revisions WHERE collection IN ('pages', 'posts', 'projects');`,
	`DELETE FROM _emdash_content_bylines WHERE collection_slug IN ('pages', 'posts', 'projects');`,
	`DELETE FROM taxonomies WHERE name IN (${(seed.taxonomies ?? []).map((taxonomy) => sqlValue(taxonomy.name)).join(", ")});`,
	`DELETE FROM _emdash_taxonomy_defs WHERE name IN (${(seed.taxonomies ?? []).map((taxonomy) => sqlValue(taxonomy.name)).join(", ")});`,
	`DELETE FROM _emdash_menu_items WHERE menu_id IN (SELECT id FROM _emdash_menus WHERE name IN (${(seed.menus ?? []).map((menu) => sqlValue(menu.name)).join(", ")}));`,
	`DELETE FROM _emdash_menus WHERE name IN (${(seed.menus ?? []).map((menu) => sqlValue(menu.name)).join(", ")});`,
	`DELETE FROM options WHERE name IN ('site:title', 'site:tagline');`,
	`INSERT INTO options (name, value) VALUES ('site:title', ${sqlValue(JSON.stringify(seed.settings?.title ?? ""))}), ('site:tagline', ${sqlValue(JSON.stringify(seed.settings?.tagline ?? ""))});`,
	"PRAGMA foreign_keys = ON;",
];

runStatementChunks(cleanupStatements, "seed-sync-cleanup");
runStatementChunks(taxonomyDefStatements, "seed-sync-taxonomy-defs");
runStatementChunks(taxonomyTermStatements, "seed-sync-taxonomies");
runStatementChunks(revisionStatements, "seed-sync-revisions");
runStatementChunks(contentStatements, "seed-sync-content");
runStatementChunks(contentTaxonomyStatements, "seed-sync-content-taxonomies");
runStatementChunks(menuStatements, "seed-sync-menus");

const after = currentSummary();
console.log(
	JSON.stringify(
		{
			mode: mode.slice(2),
			seedPath: path.relative(ROOT, seedPath),
			after,
			expected,
		},
		null,
		2,
	),
);
