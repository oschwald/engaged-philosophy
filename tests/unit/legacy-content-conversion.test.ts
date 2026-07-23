import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
	convertBackup,
	type ConversionReport,
} from "../../scripts/lib/legacy-content-conversion.mjs";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const script = fileURLToPath(
	new URL("../../scripts/plan-legacy-content-conversion.mjs", import.meta.url),
);
const fixture = fileURLToPath(
	new URL("../fixtures/legacy-content-backup.json", import.meta.url),
);

type BackupRow = Record<string, unknown> & {
	id: string;
	data?: string;
	content?: string;
};

type Backup = {
	tables: Record<string, BackupRow[]>;
};

function readBackup() {
	return JSON.parse(readFileSync(fixture, "utf8")) as Backup;
}

function parseBlocks(row: BackupRow, field = "content") {
	const value = row[field];
	if (typeof value !== "string") {
		throw new Error(`${field} is not serialized JSON`);
	}
	return JSON.parse(value) as Array<Record<string, unknown>>;
}

function contentRow(backup: Backup, table: string, id: string) {
	const row = backup.tables[table]?.find((candidate) => candidate.id === id);
	if (!row) throw new Error(`Missing ${table}:${id}`);
	return row;
}

function revisionBlocks(backup: Backup, id: string) {
	const revision = contentRow(backup, "revisions", id);
	if (typeof revision.data !== "string") {
		throw new Error(`Revision ${id} has no serialized data`);
	}
	const data = JSON.parse(revision.data) as {
		content: Array<Record<string, unknown>>;
	};
	return data.content;
}

function runPlan(...arguments_: string[]) {
	return spawnSync(process.execPath, [script, ...arguments_], {
		cwd: repositoryRoot,
		encoding: "utf8",
	});
}

describe("legacy content conversion planning", () => {
	it("converts only native-compatible blocks in an in-memory backup copy", () => {
		const source = readBackup();
		const original = structuredClone(source);
		const { backup, report } = convertBackup(source);

		expect(source).toEqual(original);
		expect(report.summary).toEqual({
			changedBlocks: 5,
			changedFields: 3,
			operations: {
				"image-media-normalization": 1,
				"legacy-embed-to-vimeo": 1,
				"legacy-embed-to-youtube": 1,
				"legacy-image-to-image": 2,
			},
			blockedOccurrences: 6,
			deferredOccurrences: 1,
		});

		const page = parseBlocks(contentRow(backup, "ec_pages", "page-1"));
		expect(page[1]).toMatchObject({
			_type: "image",
			_key: "image-ready",
			alignment: "left",
			asset: {
				_ref: "media-1",
			},
		});
		expect(page[1]).not.toHaveProperty("align");
		expect(page[2]).toMatchObject({
			_type: "legacyImage",
			href: "https://example.test/destination",
			shape: "rounded",
		});
		expect(page[4]).toEqual({
			_type: "youtube",
			_key: "youtube",
			id: "abcdefghijk",
			params: "start=30",
			title: "Video title not emitted",
		});

		const revision = revisionBlocks(backup, "revision-1");
		expect(revision[0]).toEqual({
			_type: "vimeo",
			_key: "vimeo",
			id: "12345",
			params: "color=ffffff#t=20s",
			playlabel: "Vimeo title not emitted",
		});
		expect(revision[1]).toMatchObject({
			_type: "legacyEmbed",
			provider: "animoto",
		});
		expect(revision[2]).toMatchObject({
			_type: "legacyEmbed",
			_key: "invalid-youtube",
		});
		expect(revision[3]).toMatchObject({
			columns: [
				{
					content: [
						{
							_type: "image",
							asset: {
								_ref: "https://cdn.example.test/nested.jpg",
								url: "https://cdn.example.test/nested.jpg",
							},
						},
					],
				},
			],
		});

		const post = parseBlocks(contentRow(backup, "ec_posts", "post-1"));
		expect(post[0]).toMatchObject({
			images: [
				{
					_type: "image",
					asset: {
						_ref: "media-2",
						url: "/_emdash/api/media/file/wp-content/uploads/second.jpg",
					},
				},
			],
		});
	});

	it("is idempotent", () => {
		const first = convertBackup(readBackup());
		const second = convertBackup(first.backup);

		expect(second.backup).toEqual(first.backup);
		expect(second.report.summary).toMatchObject({
			changedBlocks: 0,
			changedFields: 0,
			operations: {},
			blockedOccurrences: 6,
			deferredOccurrences: 1,
		});
	});

	it("emits deterministic reports without content text", () => {
		const first = runPlan("--input", fixture, "--json");
		const second = runPlan("--input", fixture, "--json");
		const text = runPlan("--input", fixture);

		expect(first.status).toBe(0);
		expect(second.status).toBe(0);
		expect(text.status).toBe(0);
		expect(first.stdout).toBe(second.stdout);
		expect(first.stdout).not.toContain("DO NOT LEAK THIS BODY TEXT");
		expect(first.stdout).not.toContain("A safe caption");
		expect(first.stdout).not.toContain("Video title not emitted");
		expect(first.stdout).not.toContain("Vimeo title not emitted");
		expect(text.stdout).not.toContain("DO NOT LEAK THIS BODY TEXT");
		expect(text.stdout).toContain("Would change 5 blocks in 3 fields.");
		expect(text.stdout).toContain("No backup or database was modified.");

		const report = JSON.parse(first.stdout) as ConversionReport;
		expect(report.format).toBe(
			"engaged-philosophy-legacy-content-conversion-plan",
		);
		expect(report.changes).toHaveLength(5);
		expect(
			report.blocked.some(
				(item) =>
					item.type === "legacyEmbed" &&
					item.blockers?.includes("invalid-provider-source"),
			),
		).toBe(true);
	});
});
