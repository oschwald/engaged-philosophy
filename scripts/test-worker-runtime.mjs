import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DIST_WRANGLER_CONFIG = path.join(ROOT, "dist", "server", "wrangler.json");
const PERSIST_DIR = path.join(ROOT, ".wrangler", "worker-runtime-smoke-state");
const REQUEST_TIMEOUT_MS = 1000;
const STARTUP_TIMEOUT_MS = 30_000;

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.unref();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			server.close(() => {
				if (!address || typeof address === "string") {
					reject(new Error("Could not allocate a local port"));
					return;
				}

				resolve(address.port);
			});
		});
	});
}

async function fetchWithTimeout(url) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		return await fetch(url, {
			redirect: "manual",
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeout);
	}
}

async function waitForWorker(port, child, getOutput) {
	const url = `http://127.0.0.1:${port}/`;
	const startedAt = Date.now();

	while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
		if (child.exitCode !== null) {
			throw new Error(`wrangler dev exited early\n${getOutput()}`);
		}

		try {
			const response = await fetchWithTimeout(url);
			return response;
		} catch {
			await sleep(250);
		}
	}

	throw new Error(`Timed out waiting for wrangler dev\n${getOutput()}`);
}

function assertNoRuntimeErrors(output) {
	assert.equal(
		/ReferenceError|Cannot access .* before initialization|Unhandled|\\[ERROR\\]|✘ \\[ERROR\\]/.test(
			output,
		),
		false,
		`Worker runtime smoke test logged an error\n${output}`,
	);
}

async function stopProcess(child) {
	if (child.exitCode !== null) return;

	try {
		process.kill(-child.pid, "SIGTERM");
	} catch {
		child.kill("SIGTERM");
	}

	await Promise.race([
		new Promise((resolve) => child.once("exit", resolve)),
		sleep(3000).then(() => {
			if (child.exitCode === null) {
				try {
					process.kill(-child.pid, "SIGKILL");
				} catch {
					child.kill("SIGKILL");
				}
			}
		}),
	]);
}

if (!existsSync(DIST_WRANGLER_CONFIG)) {
	throw new Error("Run npm run build before npm run test:worker-runtime.");
}

await rm(PERSIST_DIR, { recursive: true, force: true });

const port = await getFreePort();
let output = "";

const child = spawn(
	"npx",
	[
		"wrangler",
		"dev",
		"--config",
		DIST_WRANGLER_CONFIG,
		"--ip",
		"127.0.0.1",
		"--port",
		String(port),
		"--local",
		"--persist-to",
		PERSIST_DIR,
		"--log-level",
		"error",
		"--show-interactive-dev-session=false",
	],
	{
		cwd: ROOT,
		detached: true,
		stdio: ["ignore", "pipe", "pipe"],
	},
);

child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
	output += chunk;
});
child.stderr.on("data", (chunk) => {
	output += chunk;
});

try {
	const response = await waitForWorker(port, child, () => output);
	await sleep(500);
	assertNoRuntimeErrors(output);
	assert.ok(
		response.status < 500,
		`Expected local Worker to return a non-5xx response, got ${response.status}\n${output}`,
	);
} finally {
	await stopProcess(child);
}

console.log("Worker runtime smoke test passed.");
