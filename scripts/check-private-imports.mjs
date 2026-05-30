#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const ALLOWED_FILES = new Set([
	path.join(SRC_DIR, "lib", "emdash-inline-editor.tsx"),
]);
const PRIVATE_IMPORT_PATTERNS = [
	"node_modules/emdash/src",
	"emdash/src",
	"node_modules/@emdash-cms",
];
const SOURCE_EXTENSIONS = new Set([
	".astro",
	".js",
	".jsx",
	".mjs",
	".ts",
	".tsx",
]);

function walk(dir) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	return entries.flatMap((entry) => {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) return walk(fullPath);
		return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
	});
}

const violations = walk(SRC_DIR).flatMap((filePath) => {
	if (ALLOWED_FILES.has(filePath)) return [];
	const source = fs.readFileSync(filePath, "utf8");
	return PRIVATE_IMPORT_PATTERNS.flatMap((pattern) =>
		source.includes(pattern) ? [{ filePath, pattern }] : [],
	);
});

if (violations.length > 0) {
	console.error(
		"Private EmDash imports must stay behind src/lib/emdash-inline-editor.tsx.",
	);
	for (const violation of violations) {
		console.error(
			`- ${path.relative(ROOT, violation.filePath)} imports ${violation.pattern}`,
		);
	}
	process.exitCode = 1;
} else {
	console.log("Private import check passed.");
}
