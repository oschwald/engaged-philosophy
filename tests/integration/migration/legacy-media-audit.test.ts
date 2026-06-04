import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

const auditScript = new URL(
	"../../../scripts/migration/audit-legacy-media.mjs",
	import.meta.url,
).pathname;

function writeSeed(
	tempDir: string,
	name: string,
	seed: Record<string, unknown>,
) {
	const seedPath = path.join(tempDir, name);
	writeFileSync(seedPath, JSON.stringify(seed, null, 2));
	return seedPath;
}

function runAudit(seedPath: string) {
	return spawnSync(process.execPath, [auditScript, "--seed", seedPath], {
		encoding: "utf8",
	});
}

const validSeed = {
	media: {
		1: {
			url: "https://www.engagedphilosophy.com/wp-content/uploads/2024/05/photo.jpg",
			filename: "photo.jpg",
			mimeType: "image/jpeg",
			createdAt: "2024-05-01T00:00:00Z",
		},
	},
	content: {
		pages: [
			{
				id: "page-1",
				slug: "fixture",
				data: {
					featured_image: {
						provider: "local",
						id: "wp-media-1",
						meta: {
							storageKey: "wp-content/uploads/2024/05/photo.jpg",
						},
					},
					content: [
						{
							_type: "legacyImage",
							_key: "legacy",
							id: "/_emdash/api/media/file/wp-content/uploads/2024/05/photo.jpg",
							href: "/_emdash/api/media/file/wp-content/uploads/2024/05/photo.jpg",
						},
						{
							_type: "image",
							_key: "standard",
							asset: {
								_ref: "wp-media-1",
								url: "/_emdash/api/media/file/wp-content/uploads/2024/05/photo.jpg",
							},
						},
					],
				},
			},
		],
	},
};

describe("legacy media audit CLI", () => {
	test("passes durable media references and fails raw WordPress upload URLs", () => {
		const invalidSeed = structuredClone(validSeed);
		invalidSeed.content.pages[0].data.content[0] = {
			_type: "legacyImage",
			_key: "raw",
			url: "https://www.engagedphilosophy.com/wp-content/uploads/2024/05/photo.jpg",
		};

		const tempDir = mkdtempSync(path.join(os.tmpdir(), "legacy-media-audit-"));
		try {
			const validResult = runAudit(writeSeed(tempDir, "valid.json", validSeed));
			expect(validResult.status, validResult.stderr || validResult.stdout).toBe(
				0,
			);
			expect(validResult.stdout).toMatch(/"issueCount": 0/);

			const invalidResult = runAudit(
				writeSeed(tempDir, "invalid.json", invalidSeed),
			);
			expect(invalidResult.status).toBe(1);
			expect(invalidResult.stdout).toMatch(
				/legacyImage source is not an EmDash/,
			);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
