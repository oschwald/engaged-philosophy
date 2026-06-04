import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

import { chromium } from "playwright";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DIST_WRANGLER_CONFIG = path.join(ROOT, "dist", "server", "wrangler.json");
const PERSIST_DIR = path.join(ROOT, ".wrangler", "worker-admin-e2e-state");
const STARTUP_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 15_000;
const TEST_AUTH_HEADER = "X-EmDash-Test-Auth";

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveBrowserPath() {
	const candidates = [
		process.env.RENDERED_SMOKE_BROWSER_PATH,
		"/usr/bin/google-chrome",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
	].filter(Boolean);
	return candidates.find((candidate) => existsSync(candidate)) || "";
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

async function fetchWithTimeout(url, options = {}) {
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

async function waitForWorker(port, child, getOutput) {
	const url = `http://127.0.0.1:${port}/`;
	const startedAt = Date.now();

	while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
		if (child.exitCode !== null) {
			throw new Error(`wrangler dev exited early\n${getOutput()}`);
		}

		try {
			await fetchWithTimeout(url);
			return;
		} catch {
			await sleep(250);
		}
	}

	throw new Error(`Timed out waiting for wrangler dev\n${getOutput()}`);
}

function assertNoWorkerErrors(output) {
	assert.equal(
		/EmDash middleware error|Cannot read properties of undefined \(reading 'every'\)|ReferenceError|Cannot access .* before initialization|Unhandled|\[ERROR\]|✘ \[ERROR\]/.test(
			output,
		),
		false,
		`Worker admin e2e logged an error\n${output}`,
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

function runBuildWithTestAuth() {
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
		throw new Error(`Test-auth worker build failed\n${output}`);
	}
}

async function jsonRequest(baseUrl, pathName, options = {}) {
	let response;
	try {
		response = await fetchWithTimeout(`${baseUrl}${pathName}`, {
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
	let body = null;
	if (text) {
		body = JSON.parse(text);
	}

	assert.ok(
		response.status >= 200 && response.status < 300,
		`Expected ${pathName} to return 2xx, got ${response.status}\n${text}`,
	);

	return body;
}

async function completeSetup(baseUrl) {
	const body = await jsonRequest(baseUrl, "/_emdash/api/setup", {
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

	assert.equal(body?.data?.setupComplete, true);
}

async function assertAdminApis(baseUrl) {
	const me = await jsonRequest(baseUrl, "/_emdash/api/auth/me");
	assert.equal(me?.data?.email, "admin@example.test");
	assert.equal(me?.data?.role, 50);

	const manifest = await jsonRequest(baseUrl, "/_emdash/api/manifest");
	for (const slug of ["pages", "posts", "projects"]) {
		assert.ok(
			Object.hasOwn(manifest?.data?.collections ?? {}, slug),
			`Expected manifest to include ${slug}`,
		);
	}

	await jsonRequest(baseUrl, "/_emdash/api/dashboard");

	for (const slug of ["pages", "posts", "projects"]) {
		await jsonRequest(baseUrl, `/_emdash/api/content/${slug}?limit=1`);
	}

	await jsonRequest(baseUrl, "/_emdash/api/media?limit=1");
	await jsonRequest(baseUrl, "/_emdash/api/media/providers");
}

async function assertAdminPage(baseUrl) {
	const browser = await chromium.launch({
		executablePath: resolveBrowserPath() || undefined,
		headless: true,
	});

	try {
		const context = await browser.newContext({
			extraHTTPHeaders: {
				[TEST_AUTH_HEADER]: "1",
			},
		});
		const page = await context.newPage();
		const errors = [];

		page.on("console", (message) => {
			if (message.type() === "error") {
				errors.push(message.text());
			}
		});
		page.on("pageerror", (error) => {
			errors.push(error.message);
		});

		const response = await page.goto(`${baseUrl}/_emdash/admin`, {
			waitUntil: "domcontentloaded",
			timeout: REQUEST_TIMEOUT_MS,
		});

		assert.ok(response, "Expected an admin page response");
		assert.ok(
			response.status() >= 200 && response.status() < 300,
			`Expected admin page to load, got ${response.status()}`,
		);
		assert.equal(
			await page.getByText("Authentication required").count(),
			0,
			"Admin page should not render an auth-required state.",
		);
		assert.equal(
			errors.length,
			0,
			`Admin page logged errors:\n${errors.join("\n")}`,
		);
	} finally {
		await browser.close();
	}
}

runBuildWithTestAuth();

if (!existsSync(DIST_WRANGLER_CONFIG)) {
	throw new Error(
		"Expected test-auth build to create dist/server/wrangler.json.",
	);
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
	await waitForWorker(port, child, () => output);
	const baseUrl = `http://127.0.0.1:${port}`;
	await completeSetup(baseUrl);
	await assertAdminApis(baseUrl);
	await assertAdminPage(baseUrl);
	await sleep(500);
	assertNoWorkerErrors(output);
} finally {
	await stopProcess(child);
}

console.log("Worker admin e2e test passed.");
