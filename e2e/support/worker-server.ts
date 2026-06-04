import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

export const TEST_AUTH_HEADER = "X-EmDash-Test-Auth";

const ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
const DIST_WRANGLER_CONFIG = path.join(ROOT, "dist", "server", "wrangler.json");
const STARTUP_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 15_000;
const WORKER_ERROR_PATTERN =
	/EmDash middleware error|Cannot read properties of undefined \(reading 'every'\)|ReferenceError|Cannot access .* before initialization|Unhandled|\[ERROR\]|✘ \[ERROR\]/;

export interface WorkerServer {
	baseURL: string;
	assertNoErrors: () => void;
	getOutput: () => string;
	stop: () => Promise<void>;
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
	return new Promise<number>((resolve, reject) => {
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

async function fetchWithTimeout(url: string, options: RequestInit = {}) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		return await fetch(url, {
			redirect: "manual",
			...options,
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeout);
	}
}

async function waitForWorker(
	port: number,
	child: ChildProcess,
	getOutput: () => string,
) {
	const url = `http://127.0.0.1:${port}/_emdash/api/manifest`;
	const startedAt = Date.now();

	while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
		if (child.exitCode !== null) {
			throw new Error(`wrangler dev exited early\n${getOutput()}`);
		}

		try {
			const response = await fetchWithTimeout(url, {
				headers: {
					[TEST_AUTH_HEADER]: "1",
					"X-EmDash-Request": "1",
				},
			});
			const text = await response.text();
			if (
				response.status >= 200 &&
				response.status < 500 &&
				text.trim().startsWith("{")
			) {
				return;
			}
		} catch {
			await sleep(250);
		}
	}

	throw new Error(`Timed out waiting for wrangler dev\n${getOutput()}`);
}

async function stopProcess(child: ChildProcess) {
	if (child.exitCode !== null) return;

	try {
		if (child.pid) process.kill(-child.pid, "SIGTERM");
	} catch {
		child.kill("SIGTERM");
	}

	await Promise.race([
		new Promise((resolve) => child.once("exit", resolve)),
		sleep(3000).then(() => {
			if (child.exitCode === null) {
				try {
					if (child.pid) process.kill(-child.pid, "SIGKILL");
				} catch {
					child.kill("SIGKILL");
				}
			}
		}),
	]);
}

export function buildWorkerForE2E() {
	const result = spawnSync("npm", ["run", "build"], {
		cwd: ROOT,
		encoding: "utf8",
		env: {
			...process.env,
			EMDASH_TEST_AUTH: "1",
		},
		stdio: ["ignore", "pipe", "pipe"],
	});

	if (result.status !== 0) {
		const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
		throw new Error(`Test-auth Worker build failed\n${output}`);
	}

	if (!existsSync(DIST_WRANGLER_CONFIG)) {
		throw new Error(
			"Expected test-auth build to create dist/server/wrangler.json.",
		);
	}

	process.env.EMDASH_E2E_BUILD_READY = "1";
}

function ensureWorkerBuild() {
	if (process.env.EMDASH_E2E_BUILD_READY !== "1") {
		buildWorkerForE2E();
		return;
	}

	if (!existsSync(DIST_WRANGLER_CONFIG)) {
		buildWorkerForE2E();
	}
}

export async function jsonRequest(
	baseURL: string,
	pathName: string,
	options: RequestInit = {},
) {
	let response: Response;
	try {
		response = await fetchWithTimeout(`${baseURL}${pathName}`, {
			...options,
			headers: {
				[TEST_AUTH_HEADER]: "1",
				"X-EmDash-Request": "1",
				...(options.headers ?? {}),
			},
		});
	} catch (error) {
		throw new Error(`Request to ${pathName} failed or timed out`, {
			cause: error,
		});
	}

	const text = await response.text();
	let body: unknown = null;
	try {
		body = text ? JSON.parse(text) : null;
	} catch (error) {
		throw new Error(
			`Expected ${pathName} to return JSON, got ${response.status}\n${text}`,
			{ cause: error },
		);
	}

	assert.ok(
		response.status >= 200 && response.status < 300,
		`Expected ${pathName} to return 2xx, got ${response.status}\n${text}`,
	);

	return body;
}

export async function completeSetup(baseURL: string) {
	const body = await jsonRequest(baseURL, "/_emdash/api/setup", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			title: "Engaged Philosophy",
			tagline: "Civic Engagement in Philosophy Classes",
			includeContent: false,
		}),
	});

	const data =
		body && typeof body === "object" && "data" in body ? body.data : undefined;
	const setupComplete =
		data && typeof data === "object" && "setupComplete" in data
			? data.setupComplete
			: undefined;
	assert.equal(setupComplete, true);
}

export async function startWorkerServer(
	workerIndex: number,
): Promise<WorkerServer> {
	ensureWorkerBuild();

	const persistDir = path.join(
		ROOT,
		".wrangler",
		"e2e-state",
		`worker-${workerIndex}`,
	);
	await rm(persistDir, { recursive: true, force: true });

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
			persistDir,
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

	child.stdout?.setEncoding("utf8");
	child.stderr?.setEncoding("utf8");
	child.stdout?.on("data", (chunk) => {
		output += chunk;
	});
	child.stderr?.on("data", (chunk) => {
		output += chunk;
	});

	await waitForWorker(port, child, () => output);

	return {
		baseURL: `http://127.0.0.1:${port}`,
		getOutput: () => output,
		assertNoErrors: () => {
			assert.equal(
				WORKER_ERROR_PATTERN.test(output),
				false,
				`Worker e2e logged an error\n${output}`,
			);
		},
		stop: () => stopProcess(child),
	};
}
