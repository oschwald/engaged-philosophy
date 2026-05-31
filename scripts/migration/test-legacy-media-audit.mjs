import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const auditScript = path.join(__dirname, "audit-legacy-media.mjs");

function writeSeed(tempDir, name, seed) {
	const seedPath = path.join(tempDir, name);
	writeFileSync(seedPath, JSON.stringify(seed, null, 2));
	return seedPath;
}

function runAudit(seedPath) {
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

const invalidSeed = structuredClone(validSeed);
invalidSeed.content.pages[0].data.content[0] = {
	_type: "legacyImage",
	_key: "raw",
	url: "https://www.engagedphilosophy.com/wp-content/uploads/2024/05/photo.jpg",
};

const tempDir = mkdtempSync(path.join(os.tmpdir(), "legacy-media-audit-"));
try {
	const validResult = runAudit(writeSeed(tempDir, "valid.json", validSeed));
	assert.equal(validResult.status, 0, validResult.stderr || validResult.stdout);
	assert.match(validResult.stdout, /"issueCount": 0/);

	const invalidResult = runAudit(
		writeSeed(tempDir, "invalid.json", invalidSeed),
	);
	assert.equal(invalidResult.status, 1);
	assert.match(invalidResult.stdout, /legacyImage source is not an EmDash/);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
