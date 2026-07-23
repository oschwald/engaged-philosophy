import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const script = fileURLToPath(
	new URL("../../scripts/audit-legacy-content.mjs", import.meta.url),
);
const fixture = fileURLToPath(
	new URL("../fixtures/legacy-content-backup.json", import.meta.url),
);
const malformedFixture = fileURLToPath(
	new URL("../fixtures/legacy-content-backup-malformed.txt", import.meta.url),
);

type Occurrence = {
	sourceKind: string;
	collection: string;
	entryId: string;
	revisionId?: string;
	field: string;
	blockPath: string;
	type: string;
	classification: string;
	blockers: string[];
	mediaResolution?: string;
	provider?: string;
};

type Inventory = {
	format: string;
	formatVersion: number;
	portableTextSchema: Record<string, string[]>;
	summary: {
		sources: {
			contentRows: number;
			contentRowsByState: Record<string, number>;
			revisionRows: number;
			portableTextValues: number;
			invalidPortableTextValues: number;
		};
		trackedOccurrences: number;
		media: {
			references: number;
			resolved: number;
			external: number;
			unresolved: number;
		};
		byType: Record<
			string,
			{
				total: number;
				classifications: Record<string, number>;
				blockers: Record<string, number>;
			}
		>;
	};
	diagnostics: Array<{ code: string }>;
	occurrences: Occurrence[];
};

function runAudit(...arguments_: string[]) {
	return spawnSync(process.execPath, [script, ...arguments_], {
		cwd: repositoryRoot,
		encoding: "utf8",
	});
}

function findOccurrence(
	inventory: Inventory,
	type: string,
	predicate: (occurrence: Occurrence) => boolean = () => true,
) {
	return inventory.occurrences.find(
		(occurrence) => occurrence.type === type && predicate(occurrence),
	);
}

describe("legacy content inventory", () => {
	it("discovers Portable Text fields and inventories current and historical data", () => {
		const result = runAudit("--input", fixture, "--json");

		expect(result.status).toBe(0);
		const inventory = JSON.parse(result.stdout) as Inventory;

		expect(inventory.format).toBe(
			"engaged-philosophy-legacy-content-inventory",
		);
		expect(inventory.formatVersion).toBe(1);
		expect(inventory.portableTextSchema).toEqual({
			pages: ["about_html", "content"],
			posts: ["content", "excerpt"],
		});
		expect(inventory.summary.sources).toEqual({
			contentRows: 4,
			contentRowsByState: {
				draft: 1,
				published: 1,
				scheduled: 1,
				trashed: 1,
			},
			revisionRows: 2,
			portableTextValues: 6,
			invalidPortableTextValues: 1,
		});
		expect(inventory.diagnostics.map(({ code }) => code)).toEqual([
			"invalid-portable-text-json",
			"invalid-revision-data",
		]);

		expect(
			findOccurrence(
				inventory,
				"legacyEmbed",
				(occurrence) => occurrence.provider === "vimeo",
			),
		).toMatchObject({
			sourceKind: "revision",
			revisionId: "revision-1",
			classification: "native-ready",
		});
		expect(
			findOccurrence(inventory, "legacyImage", (occurrence) =>
				occurrence.blockPath.includes(".columns"),
			),
		).toMatchObject({
			sourceKind: "revision",
			classification: "native-ready-after-media-normalization",
			mediaResolution: "external",
		});
		expect(
			findOccurrence(inventory, "legacyImage", (occurrence) =>
				occurrence.blockers.includes("linked-image"),
			),
		).toMatchObject({
			classification: "blocked",
			mediaResolution: "media-row",
		});
		expect(
			findOccurrence(inventory, "legacyEmbed", (occurrence) =>
				occurrence.blockers.includes("invalid-provider-source"),
			),
		).toMatchObject({
			classification: "blocked",
			provider: "youtube",
		});
		expect(inventory.summary.byType.gallery).toMatchObject({
			total: 2,
			classifications: {
				blocked: 1,
				"native-ready-after-media-normalization": 1,
			},
		});
		expect(inventory.summary.byType.numberedHeadingPattern.total).toBe(1);
		expect(inventory.summary.media).toEqual({
			references: 5,
			resolved: 4,
			external: 1,
			unresolved: 0,
		});
	});

	it("keeps body text out of both output formats", () => {
		const jsonResult = runAudit("--input", fixture, "--json");
		const textResult = runAudit("--input", fixture);

		expect(jsonResult.status).toBe(0);
		expect(textResult.status).toBe(0);
		expect(jsonResult.stdout).not.toContain("DO NOT LEAK THIS BODY TEXT");
		expect(textResult.stdout).not.toContain("DO NOT LEAK THIS BODY TEXT");
		expect(textResult.stdout).toContain("Legacy content inventory");
		expect(textResult.stdout).toContain(
			"legacyEmbed/native-ready: pages:page-1 revision=revision-1",
		);
	});

	it("produces deterministic JSON", () => {
		const first = runAudit("--input", fixture, "--json");
		const second = runAudit("--input", fixture, "--json");

		expect(first.status).toBe(0);
		expect(second.status).toBe(0);
		expect(first.stdout).toBe(second.stdout);
	});

	it("fails safely when the backup is malformed", () => {
		const result = runAudit("--input", malformedFixture, "--json");

		expect(result.status).toBe(1);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("Could not read a valid JSON backup");
		expect(result.stderr).toContain("writes only to stdout");
	});
});
