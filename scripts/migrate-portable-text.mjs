import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import seed from "../seed/seed.json" with { type: "json" };

import {
	htmlToPortableText,
	isPortableTextJson,
} from "./lib/portable-text.mjs";

const ROOT = process.cwd();
const DATABASE_NAME = "engaged-philosophy";
const FIELD_MAP = {
	pages: [
		"content",
		"about_html",
		"box_left_html",
		"box_middle_html",
		"box_right_html",
	],
	posts: ["excerpt", "content"],
	projects: ["excerpt", "content"],
};

const mode = process.argv.includes("--remote")
	? "--remote"
	: process.argv.includes("--local")
		? "--local"
		: "--local";

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

	if (result.error) {
		throw result.error;
	}

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

function buildRowUpdates(collection, rows, mediaById) {
	const updates = [];
	const fields = FIELD_MAP[collection];

	for (const row of rows) {
		const assignments = [];

		for (const field of fields) {
			const value = row[field];
			if (
				typeof value !== "string" ||
				!value.trim() ||
				isPortableTextJson(value)
			) {
				continue;
			}

			const portableText = htmlToPortableText(value, mediaById);
			assignments.push(
				`${field} = '${escapeSqlString(JSON.stringify(portableText))}'`,
			);
		}

		if (assignments.length > 0) {
			updates.push(
				`UPDATE ec_${collection} SET ${assignments.join(", ")} WHERE id = '${escapeSqlString(row.id)}';`,
			);
		}
	}

	return updates;
}

function buildRevisionUpdates(revisions, mediaById) {
	const updates = [];

	for (const revision of revisions) {
		if (typeof revision.data !== "string") continue;

		let parsed;
		try {
			parsed = JSON.parse(revision.data);
		} catch {
			continue;
		}

		const fields = FIELD_MAP[revision.collection];
		if (!fields) continue;

		let changed = false;
		for (const field of fields) {
			const value = parsed[field];
			if (
				typeof value !== "string" ||
				!value.trim() ||
				isPortableTextJson(value)
			) {
				continue;
			}

			parsed[field] = htmlToPortableText(value, mediaById);
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

const mediaById = seed.media ?? {};
const statements = [];

for (const [collection, fields] of Object.entries(FIELD_MAP)) {
	for (const field of fields) {
		statements.push(
			`UPDATE _emdash_fields SET type = 'portableText', column_type = 'JSON', widget = 'portableText' WHERE slug = '${field}' AND collection_id = (SELECT id FROM _emdash_collections WHERE slug = '${collection}');`,
		);
	}

	const rows = executeQuery(
		`SELECT id, ${fields.join(", ")} FROM ec_${collection};`,
	);
	statements.push(...buildRowUpdates(collection, rows, mediaById));
}

const revisions = executeQuery(
	`SELECT id, collection, data FROM revisions WHERE collection IN ('pages', 'posts', 'projects');`,
);
statements.push(...buildRevisionUpdates(revisions, mediaById));

const sqlPath = path.join(
	os.tmpdir(),
	`engaged-philosophy-portable-text-${Date.now()}.sql`,
);

fs.writeFileSync(sqlPath, `${statements.join("\n")}\n`);

try {
	runWrangler(["--file", sqlPath]);
	console.log(`Portable Text migration applied (${mode.slice(2)})`);
} finally {
	fs.unlinkSync(sqlPath);
}
