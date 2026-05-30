import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const DATABASE_NAME = "engaged-philosophy";
const mode = process.argv.includes("--remote")
	? "--remote"
	: process.argv.includes("--local")
		? "--local"
		: "--local";

const COLLECTION_RENAMES = [
	{
		collection: "pages",
		table: "ec_pages",
		fieldRenames: [["content_html", "content"]],
	},
	{
		collection: "posts",
		table: "ec_posts",
		fieldRenames: [
			["excerpt_html", "excerpt"],
			["content_html", "content"],
		],
	},
	{
		collection: "projects",
		table: "ec_projects",
		fieldRenames: [
			["excerpt_html", "excerpt"],
			["content_html", "content"],
		],
	},
];

function runWrangler(args) {
	const result = spawnSync(
		"npx",
		["wrangler", "d1", "execute", DATABASE_NAME, "--json", mode, ...args],
		{
			cwd: ROOT,
			encoding: "utf8",
			maxBuffer: 16 * 1024 * 1024,
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

function getTableColumns(table) {
	return new Set(
		executeQuery(`PRAGMA table_info(${table});`).map((column) => column.name),
	);
}

function buildRevisionUpdates() {
	const revisions = executeQuery(
		"SELECT id, collection, data FROM revisions WHERE collection IN ('pages', 'posts', 'projects');",
	);
	const updates = [];

	for (const revision of revisions) {
		if (typeof revision.data !== "string") continue;

		let parsed;
		try {
			parsed = JSON.parse(revision.data);
		} catch {
			continue;
		}

		const renames =
			COLLECTION_RENAMES.find((item) => item.collection === revision.collection)
				?.fieldRenames ?? [];
		let changed = false;

		for (const [from, to] of renames) {
			if (!Object.hasOwn(parsed, from)) continue;
			if (!Object.hasOwn(parsed, to)) {
				parsed[to] = parsed[from];
			}
			delete parsed[from];
			changed = true;
		}

		if (changed) {
			updates.push(
				`UPDATE revisions SET data = '${escapeSqlString(JSON.stringify(parsed))}' WHERE id = '${escapeSqlString(revision.id)}';`,
			);
		}
	}

	return updates;
}

const statements = [];

for (const { collection, table, fieldRenames } of COLLECTION_RENAMES) {
	const columns = getTableColumns(table);

	for (const [from, to] of fieldRenames) {
		if (columns.has(from) && !columns.has(to)) {
			statements.push(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to};`);
		}

		statements.push(
			`UPDATE _emdash_fields SET slug = '${to}', label = '${to === "content" ? "Content" : "Excerpt"}', type = 'portableText', column_type = 'JSON', widget = 'portableText' WHERE slug = '${from}' AND collection_id = (SELECT id FROM _emdash_collections WHERE slug = '${collection}');`,
		);
	}
}

statements.push(...buildRevisionUpdates());

if (statements.length === 0) {
	console.log(`Importer schema already aligned (${mode.slice(2)})`);
	process.exit(0);
}

const sqlPath = path.join(
	os.tmpdir(),
	`engaged-philosophy-importer-schema-${Date.now()}.sql`,
);

fs.writeFileSync(sqlPath, `${statements.join("\n")}\n`);

try {
	runWrangler(["--file", sqlPath]);
	console.log(`Importer schema migration applied (${mode.slice(2)})`);
} finally {
	fs.unlinkSync(sqlPath);
}
