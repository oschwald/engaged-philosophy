import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const DAY_MS = 86_400_000;

// Old revisions are replayed as column assignments when published in EmDash
// 0.38, so retaining their removed path field would make restoration fail.
export const POST_PATH_REVISION_CLEANUP_SQL = `UPDATE revisions
SET data = json_remove(data, '$.path')
WHERE collection = 'posts' AND json_type(data, '$.path') IS NOT NULL;`;
const localDate = new Intl.DateTimeFormat("en-CA", {
	timeZone: "America/Los_Angeles",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

/**
 * Plan the one-time timestamp corrections without moving existing post URLs.
 * Only posts whose stored date matches their Pacific publication date qualify.
 * Late-night posts move into the final milliseconds of that UTC date, retaining
 * their order relative to both each other and already-correct posts.
 */
export function planPostPathDates(rows) {
	const groups = new Map();
	const updates = [];
	const undated = [];
	for (const row of rows) {
		if (!row.published_at && row.status !== "published") {
			undated.push(row.id);
			continue;
		}
		const value = row.published_at;
		const utcValue =
			typeof value === "string" &&
			/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)
				? `${value.replace(" ", "T")}Z`
				: value;
		const timestamp = Date.parse(utcValue);
		if (!row.published_at || !Number.isFinite(timestamp)) {
			throw new Error(`Post ${row.id} has no valid publication date.`);
		}
		const match = /^(\d{4})\/(\d{2})\/(\d{2})\/[^/]+$/.exec(
			(row.path ?? "").replace(/^\/+|\/+$/g, ""),
		);
		if (!match)
			throw new Error(`Post ${row.id} has an unexpected stored path.`);
		const day = `${match[1]}-${match[2]}-${match[3]}`;
		const utcDay = new Date(timestamp).toISOString().slice(0, 10);
		const needsChange = day !== utcDay;
		if (needsChange && localDate.format(timestamp) !== day) {
			throw new Error(
				`Post ${row.id} has a path/date mismatch beyond timezone conversion.`,
			);
		}
		if (!groups.has(day)) groups.set(day, []);
		groups.get(day).push({ row, timestamp, needsChange });
	}

	for (const [day, entries] of groups) {
		const changed = entries.filter((entry) => entry.needsChange);
		const originalTimes = [
			...new Set(changed.map((entry) => entry.timestamp)),
		].sort((a, b) => a - b);
		const end = Date.parse(`${day}T00:00:00Z`) + DAY_MS;
		const replacements = new Map(
			originalTimes.map((time, index) => [
				time,
				end - originalTimes.length + index,
			]),
		);
		for (const entry of changed) {
			const replacement = replacements.get(entry.timestamp);
			updates.push({
				id: entry.row.id,
				path: entry.row.path,
				before: entry.row.published_at,
				after: new Date(replacement).toISOString(),
			});
		}
	}
	const datesById = new Map(
		updates.map((update) => [update.id, Date.parse(update.after)]),
	);
	const ordered = [...groups.values()]
		.flat()
		.sort((a, b) => a.timestamp - b.timestamp);
	for (let index = 1; index < ordered.length; index++) {
		const previous = ordered[index - 1];
		const current = ordered[index];
		const before = datesById.get(previous.row.id) ?? previous.timestamp;
		const after = datesById.get(current.row.id) ?? current.timestamp;
		if (
			Math.sign(after - before) !==
			Math.sign(current.timestamp - previous.timestamp)
		) {
			throw new Error(`Cannot preserve post ordering near ${current.row.id}.`);
		}
	}
	return { updates, undated };
}

function sqlString(value) {
	return `'${value.replaceAll("'", "''")}'`;
}

/** One guarded statement: a stale snapshot changes no posts. */
export function postPathDateSql(rows, updates) {
	if (updates.length === 0) return "SELECT 0 AS changed_posts;\n";
	const fields = [
		"slug",
		"path",
		"status",
		"published_at",
		"version",
		"updated_at",
		"deleted_at",
	];
	const snapshot = rows.map((row) =>
		Object.fromEntries(
			["id", ...fields].map((field) => [field, row[field] ?? null]),
		),
	);
	const mismatch = fields
		.map(
			(field) =>
				`post.${field} IS NOT json_extract(expected.value, '$.${field}')`,
		)
		.join("\n      OR ");
	return `UPDATE ec_posts
SET published_at = CASE id
${updates.map((update) => `  WHEN ${sqlString(update.id)} THEN ${sqlString(update.after)}`).join("\n")}
END,
version = version + 1,
updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id IN (${updates.map((update) => sqlString(update.id)).join(", ")})
  AND (SELECT count(*) FROM ec_posts) = ${rows.length}
  AND NOT EXISTS (
    SELECT 1 FROM _emdash_entry_locks
    WHERE collection = 'posts' AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  )
  AND NOT EXISTS (
    SELECT 1 FROM json_each(${sqlString(JSON.stringify(snapshot))}) AS expected
    LEFT JOIN ec_posts AS post ON post.id = json_extract(expected.value, '$.id')
    WHERE post.id IS NULL OR ${mismatch}
  )
RETURNING id, published_at;\n`;
}

if (import.meta.main) {
	const [input, directory] = process.argv.slice(2);
	if (!input || !directory) {
		throw new Error(
			"Usage: node scripts/prepare-post-paths.mjs <wrangler-posts.json> <ignored-output-directory>",
		);
	}
	const exportData = JSON.parse(await readFile(input, "utf8"));
	if (!exportData[0]?.success || !Array.isArray(exportData[0].results)) {
		throw new Error("Expected successful Wrangler JSON query output.");
	}
	const rows = exportData[0].results;
	const plan = planPostPathDates(rows);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	await writeFile(
		resolve(directory, "dates-plan.json"),
		`${JSON.stringify(plan, null, 2)}\n`,
		{ mode: 0o600 },
	);
	await writeFile(
		resolve(directory, "dates.sql"),
		postPathDateSql(rows, plan.updates),
		{ mode: 0o600 },
	);
	await writeFile(
		resolve(directory, "revisions.sql"),
		`${POST_PATH_REVISION_CLEANUP_SQL}\n`,
		{ mode: 0o600 },
	);
	console.log(
		`Audited ${rows.length} posts: ${plan.updates.length} timestamp changes, ${plan.undated.length} undated drafts. No database changes made.`,
	);
}
