import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DIST_WRANGLER_CONFIG = path.join(ROOT, "dist", "server", "wrangler.json");
const OUT_DIR = path.join(ROOT, ".wrangler", "worker-bundle-smoke");
const cloudflareWorkersModule = `
export const env = {};
export const exports = {};
export function waitUntil(promise) {
	Promise.resolve(promise).catch(() => {});
}
export class DurableObject {}
export class WorkerEntrypoint {
	constructor(ctx = {}, env = {}) {
		this.ctx = ctx;
		this.env = env;
	}
}
`;
const cloudflareWorkersUrl = `data:text/javascript,${encodeURIComponent(
	cloudflareWorkersModule,
)}`;

function run(command, args) {
	const result = spawnSync(command, args, {
		cwd: ROOT,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});

	if (result.status !== 0) {
		const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
		throw new Error(
			`${command} ${args.join(" ")} failed with status ${result.status}\n${output}`,
		);
	}

	return result;
}

async function findChunk(prefix) {
	const chunksDir = path.join(OUT_DIR, "chunks");
	const entries = await readdir(chunksDir);
	const chunk = entries.find(
		(entry) => entry.startsWith(prefix) && entry.endsWith(".mjs"),
	);
	assert.ok(chunk, `Expected a ${prefix}*.mjs chunk in ${chunksDir}`);
	return path.join(chunksDir, chunk);
}

if (!existsSync(DIST_WRANGLER_CONFIG)) {
	throw new Error("Run pnpm run build before pnpm run test:worker-bundle.");
}

await rm(OUT_DIR, { recursive: true, force: true });

run("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--outdir", OUT_DIR]);

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === "cloudflare:workers") {
			return { url: cloudflareWorkersUrl, shortCircuit: true };
		}

		return nextResolve(specifier, context);
	},
});

const entryModule = await import(
	pathToFileURL(path.join(OUT_DIR, "entry.mjs")).href
);
assert.equal(typeof entryModule.default?.fetch, "function");

await import(pathToFileURL(await findChunk("wait-until_")).href);
await import(
	pathToFileURL(path.join(OUT_DIR, "virtual_astro_middleware.mjs")).href
);

console.log("Worker bundle smoke test passed.");
