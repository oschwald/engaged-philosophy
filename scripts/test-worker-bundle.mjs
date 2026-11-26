import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import {
	assertNoTestAuthEnv,
	findTestAuthMarkers,
	isInTestAuthOutput,
	readDeployTargets,
	TEST_AUTH_HEADER,
} from "./test-auth-build.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST_WRANGLER_CONFIG = path.join(ROOT, "dist", "server", "wrangler.json");
const OUT_DIR = path.join(ROOT, ".wrangler", "worker-bundle-smoke");
const REDIRECT_OUT_DIR = path.join(
	ROOT,
	".wrangler",
	"worker-bundle-smoke-redirect",
);
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

/**
 * Fails with the message and the offending paths when there are any.
 * @param {string[]} paths
 * @param {string} message
 */
function assertNone(paths, message) {
	const listed = paths.map((file) => `  ${path.relative(ROOT, file)}`);
	assert.ok(paths.length === 0, [message, ...listed].join("\n"));
}

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

assertNoTestAuthEnv();

if (!existsSync(DIST_WRANGLER_CONFIG)) {
	throw new Error("Run pnpm run build before pnpm run test:worker-bundle.");
}

// A bare `wrangler deploy` follows this redirect, so it must name dist/.
const deployTargets = readDeployTargets(ROOT);
assert.equal(
	path.resolve(deployTargets[0] ?? ""),
	path.resolve(DIST_WRANGLER_CONFIG),
	`Expected .wrangler/deploy/config.json to name ${path.relative(ROOT, DIST_WRANGLER_CONFIG)}. Run pnpm run build with test-auth variables unset.`,
);
assertNone(
	deployTargets.filter((target) => isInTestAuthOutput(ROOT, target)),
	"The deploy redirect names a test-auth build. Run pnpm run build with test-auth variables unset.",
);
const redirectDirs = new Set(
	deployTargets.map((target) => path.dirname(target)),
);
// The entry Worker's config was checked above. A build-time Worker, such as
// the prerender one, may be gone after the build.
assertNone(
	[...redirectDirs]
		.filter((dir) => existsSync(dir))
		.flatMap((dir) => findTestAuthMarkers(dir)),
	`A Worker that the deploy redirect names contains ${TEST_AUTH_HEADER}. Run pnpm run build with test-auth variables unset.`,
);

const distWranglerConfig = JSON.parse(
	await readFile(DIST_WRANGLER_CONFIG, "utf8"),
);
assert.deepEqual(distWranglerConfig.triggers?.crons, ["*/5 * * * *"]);

await rm(OUT_DIR, { recursive: true, force: true });
await rm(REDIRECT_OUT_DIR, { recursive: true, force: true });

// Dry-run the config that `pnpm run deploy` publishes, and a bare
// `wrangler deploy` that follows the redirect, as Workers Builds does.
run("pnpm", [
	"exec",
	"wrangler",
	"deploy",
	"--dry-run",
	"--config",
	DIST_WRANGLER_CONFIG,
	"--outdir",
	OUT_DIR,
]);
run("pnpm", [
	"exec",
	"wrangler",
	"deploy",
	"--dry-run",
	"--outdir",
	REDIRECT_OUT_DIR,
]);

const testAuthFiles = [OUT_DIR, REDIRECT_OUT_DIR].flatMap((dir) =>
	findTestAuthMarkers(dir),
);
assertNone(
	testAuthFiles,
	`The Worker bundle contains the ${TEST_AUTH_HEADER} test-auth bypass. Rebuild with test-auth variables unset before deploying.`,
);

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
assert.equal(typeof entryModule.default?.scheduled, "function");
assert.equal(typeof entryModule.PluginBridge, "function");

await import(pathToFileURL(await findChunk("wait-until_")).href);
await import(
	pathToFileURL(path.join(OUT_DIR, "virtual_astro_middleware.mjs")).href
);

console.log("Worker bundle smoke test passed.");
