import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TYPES_PATH = resolve(ROOT, "emdash-env.d.ts");
const TYPEGEN_TIMEOUT_MS = 30_000;
const require = createRequire(import.meta.url);
const astroBin = resolve(
	dirname(require.resolve("astro/package.json")),
	"bin",
	"astro.mjs",
);

function reservePort() {
	return new Promise((resolvePort, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close();
				reject(new Error("Could not reserve a local port"));
				return;
			}
			server.close((error) => {
				if (error) reject(error);
				else resolvePort(address.port);
			});
		});
	});
}

function wait(milliseconds) {
	return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function stop(child) {
	if (child.exitCode !== null || child.signalCode !== null) return;
	child.kill("SIGTERM");
	await Promise.race([
		new Promise((resolveExit) => child.once("exit", resolveExit)),
		wait(5_000),
	]);
	if (child.exitCode === null && child.signalCode === null) {
		child.kill("SIGKILL");
	}
}

async function fetchGeneratedTypes(port, child, output) {
	const deadline = Date.now() + TYPEGEN_TIMEOUT_MS;
	const url = `http://127.0.0.1:${port}/_emdash/api/typegen`;

	while (Date.now() < deadline) {
		if (child.exitCode !== null || child.signalCode !== null) {
			throw new Error(`Astro dev exited before type generation.\n${output()}`);
		}

		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(1_000),
			});
			if (response.ok) return await response.text();
		} catch {
			// The dev server is still starting.
		}

		await wait(200);
	}

	throw new Error(`Timed out waiting for EmDash type generation.\n${output()}`);
}

const expected = await readFile(TYPES_PATH, "utf8");
const statePath = await mkdtemp(resolve(tmpdir(), "engaged-philosophy-types-"));
const port = await reservePort();
let output = "";
const child = spawn(
	process.execPath,
	[
		astroBin,
		"dev",
		"--ignore-lock",
		"--host",
		"127.0.0.1",
		"--port",
		String(port),
	],
	{
		cwd: ROOT,
		env: {
			...process.env,
			ASTRO_DEV_BACKGROUND: "1",
			CLOUDFLARE_VITE_FORCE_LOCAL: "true",
			EMDASH_TYPES_CHECK_STATE: statePath,
		},
		stdio: ["ignore", "pipe", "pipe"],
	},
);

for (const stream of [child.stdout, child.stderr]) {
	stream.setEncoding("utf8");
	stream.on("data", (chunk) => {
		output = `${output}${chunk}`.slice(-8_000);
	});
}

try {
	const generated = await fetchGeneratedTypes(port, child, () => output);
	if (generated !== expected) {
		throw new Error(
			"emdash-env.d.ts is stale. Run `pnpm run dev`, stop the server after type generation, and commit the updated declaration.",
		);
	}
	console.log("EmDash generated types match the checked-in declaration.");
} finally {
	await stop(child);
	await writeFile(TYPES_PATH, expected, "utf8");
	await rm(statePath, { recursive: true, force: true });
}
