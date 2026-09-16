import { DatabaseSync } from "node:sqlite";
import { describe, expect, test } from "vitest";

import {
	planPostPathDates,
	postPathDateSql,
	POST_PATH_REVISION_CLEANUP_SQL,
} from "../../scripts/prepare-post-paths.mjs";
import { formatPublicationDate } from "../../src/lib/publication-date";
import { postPath } from "../../src/lib/content-paths";

function post(
	id: string,
	publishedAt: string | null,
	path = `2022/05/31/${id}`,
) {
	return {
		id,
		slug: id,
		path,
		status: publishedAt ? "published" : "draft",
		published_at: publishedAt,
		version: 1,
		updated_at: "2026-01-01T00:00:00Z",
		deleted_at: null,
	};
}

const rows = [
	post("earlier", "2022-05-31T20:00:00Z"),
	post("late", "2022-06-01T00:12:21Z"),
	post("latest", "2022-06-01T01:30:00Z"),
	post("draft", null),
];

describe("post path migration", () => {
	test("preserves public URLs, displayed dates, and post ordering", () => {
		const plan = planPostPathDates(rows);
		expect(plan.undated).toEqual(["draft"]);
		expect(plan.updates).toEqual([
			{
				id: "late",
				path: "2022/05/31/late",
				before: "2022-06-01T00:12:21Z",
				after: "2022-05-31T23:59:59.998Z",
			},
			{
				id: "latest",
				path: "2022/05/31/latest",
				before: "2022-06-01T01:30:00Z",
				after: "2022-05-31T23:59:59.999Z",
			},
		]);
		for (const change of plan.updates) {
			expect(postPath(change.id, change.after)).toBe(change.path);
			expect(formatPublicationDate(change.after)).toBe(
				formatPublicationDate(change.before),
			);
		}
	});

	test("refuses missing publication dates and unexplained path changes", () => {
		expect(() =>
			planPostPathDates([{ ...post("missing", null), status: "published" }]),
		).toThrow("no valid publication date");
		expect(() => planPostPathDates([post("invalid", "not a date")])).toThrow(
			"no valid publication date",
		);
		expect(() =>
			planPostPathDates([post("wrong-day", "2022-06-03T00:12:21Z")]),
		).toThrow("beyond timezone");
		expect(() =>
			planPostPathDates([
				post("unexpected", "2022-05-31T20:00:00Z", "custom/path"),
			]),
		).toThrow("unexpected stored path");
	});

	test("refuses corrections that would reorder posts at the UTC boundary", () => {
		expect(() =>
			planPostPathDates([
				post("already-at-boundary", "2022-05-31T23:59:59.999Z"),
				post("late", "2022-06-01T00:12:21Z"),
			]),
		).toThrow("Cannot preserve post ordering");
	});

	test("refuses corrections that would reorder posts across stored dates", () => {
		expect(() =>
			planPostPathDates([
				post("pacific", "2022-06-01T00:10:00Z"),
				post("utc", "2022-06-01T00:05:00Z", "2022/06/01/utc"),
			]),
		).toThrow("Cannot preserve post ordering");
	});

	test("treats offsetless SQLite timestamps as UTC on a Pacific host", () => {
		const previous = process.env.TZ;
		try {
			process.env.TZ = "America/Los_Angeles";
			const plan = planPostPathDates([
				post("earlier", "2022-05-31 20:00:00"),
				post("late", "2022-06-01 00:12:21"),
			]);
			expect(plan.updates.map((change) => [change.id, change.after])).toEqual([
				["late", "2022-05-31T23:59:59.999Z"],
			]);
		} finally {
			if (previous === undefined) delete process.env.TZ;
			else process.env.TZ = previous;
		}
	});

	test("revision cleanup preserves nested page paths and all other content", () => {
		const db = new DatabaseSync(":memory:");
		try {
			db.exec("CREATE TABLE revisions (collection TEXT, data TEXT)");
			const insert = db.prepare("INSERT INTO revisions VALUES (?, ?)");
			const data = {
				path: "parent/child",
				content: [{ text: "Keep this" }],
				_slug: "child",
			};
			for (const collection of ["posts", "pages"])
				insert.run(collection, JSON.stringify(data));
			db.exec(POST_PATH_REVISION_CLEANUP_SQL);
			const records = db.prepare("SELECT * FROM revisions").all();
			expect(JSON.parse(String(records[0].data))).toEqual({
				content: data.content,
				_slug: data._slug,
			});
			expect(JSON.parse(String(records[1].data))).toEqual(data);
		} finally {
			db.close();
		}
	});

	for (const concurrentChange of ["none", "version", "insert", "lock"]) {
		test(`the SQL changes only audited, unlocked rows (${concurrentChange})`, () => {
			const db = new DatabaseSync(":memory:");
			try {
				db.exec(
					"CREATE TABLE ec_posts (id TEXT PRIMARY KEY, slug TEXT, path TEXT, status TEXT, published_at TEXT, version INTEGER, updated_at TEXT, deleted_at TEXT)",
				);
				const insert = db.prepare(
					"INSERT INTO ec_posts VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
				);
				for (const row of rows) insert.run(...Object.values(row));
				db.exec(
					"CREATE TABLE _emdash_entry_locks (collection TEXT, expires_at TEXT)",
				);
				if (concurrentChange === "version")
					db.exec(
						"UPDATE ec_posts SET version = version + 1 WHERE id = 'earlier'",
					);
				if (concurrentChange === "insert")
					insert.run(...Object.values(post("new", "2022-05-31T21:00:00Z")));
				if (concurrentChange === "lock")
					db.exec(
						"INSERT INTO _emdash_entry_locks VALUES ('posts', '2999-01-01T00:00:00Z')",
					);
				const plan = planPostPathDates(rows);
				const changed = db.prepare(postPathDateSql(rows, plan.updates)).all();
				expect(changed).toHaveLength(concurrentChange === "none" ? 2 : 0);
				const current = db.prepare("SELECT * FROM ec_posts").all();
				expect(planPostPathDates(current).updates).toHaveLength(
					concurrentChange === "none" ? 0 : 2,
				);
				expect(
					current.find((row) => row.id === "draft")?.published_at,
				).toBeNull();
			} finally {
				db.close();
			}
		});
	}
});
