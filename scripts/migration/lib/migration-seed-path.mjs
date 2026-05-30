import fs from "node:fs";
import path from "node:path";

export const ROOT = process.cwd();
export const DEFAULT_MIGRATION_SEED_PATH = path.join(
	ROOT,
	".migration",
	"seed.json",
);

export function resolveSeedPath(value) {
	return value ? path.resolve(ROOT, value) : DEFAULT_MIGRATION_SEED_PATH;
}

export function readSeedFile(seedPath = DEFAULT_MIGRATION_SEED_PATH) {
	return JSON.parse(fs.readFileSync(seedPath, "utf8"));
}

export function parseSeedPathArg(argv) {
	const index = argv.indexOf("--seed");
	if (index === -1) return DEFAULT_MIGRATION_SEED_PATH;
	const value = argv[index + 1];
	if (!value || value.startsWith("--")) {
		throw new Error("--seed requires a file path");
	}
	return resolveSeedPath(value);
}
