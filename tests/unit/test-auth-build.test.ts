import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
	assertNoTestAuthEnv,
	buildOutDir,
	deployConfigPath,
	findTestAuthMarkers,
	presentTestAuthEnvVars,
	readDeployTargets,
	snapshotDeployConfig,
	TEST_AUTH_HEADER,
	testAuthDeployConfigGuard,
} from "../../scripts/test-auth-build.mjs";

let root: string;

beforeEach(async () => {
	root = await mkdtemp(path.join(tmpdir(), "test-auth-build-"));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

async function writeRedirect(configPath: string) {
	const file = deployConfigPath(root);
	await mkdir(path.dirname(file), { recursive: true });
	const contents = JSON.stringify({ configPath, auxiliaryWorkers: [] });
	await writeFile(file, contents);
	return contents;
}

describe("test-auth build output", () => {
	test("writes test-auth builds outside the deployable dist directory", () => {
		expect(buildOutDir({})).toBe("dist");
		expect(buildOutDir({ EMDASH_TEST_AUTH: "1" })).toBe("dist-e2e");
	});

	test("refuses to deploy with any test-auth variable set", () => {
		const disabled = { EMDASH_TEST_AUTH: "0", EMDASH_ALLOW_TEST_AUTH: "" };
		const allowed = { EMDASH_ALLOW_TEST_AUTH: "1" };

		expect(presentTestAuthEnvVars({})).toEqual([]);
		expect(() => assertNoTestAuthEnv({})).not.toThrow();
		expect(presentTestAuthEnvVars(disabled)).toEqual([
			"EMDASH_TEST_AUTH",
			"EMDASH_ALLOW_TEST_AUTH",
		]);
		expect(() => assertNoTestAuthEnv(allowed)).toThrow(
			/Unset EMDASH_ALLOW_TEST_AUTH/,
		);
	});

	test("checks the header that the test-auth provider trusts", () => {
		const provider = readFileSync(
			new URL("../../src/lib/test-auth.ts", import.meta.url),
			"utf8",
		);
		expect(provider).toContain(`"${TEST_AUTH_HEADER}"`);
	});

	test("guards deploys and test-auth builds in the build config", () => {
		const config = readFileSync(
			new URL("../../astro.config.mjs", import.meta.url),
			"utf8",
		);
		expect(config).toMatch(/outDir:\s*buildOutDir\(\)/);
		expect(config).toMatch(/useTestAuth \? \[testAuthDeployConfigGuard\(\)\]/);

		const packageJson = readFileSync(
			new URL("../../package.json", import.meta.url),
			"utf8",
		);
		const deploy: string = JSON.parse(packageJson).scripts.deploy;
		expect(deploy.split(" && ")).toEqual([
			"node scripts/check-deploy-env.mjs",
			"pnpm run build",
			"pnpm run test:worker-bundle",
			"wrangler deploy --config dist/server/wrangler.json",
		]);
	});
});

describe("deploy redirect", () => {
	test("resolves the Worker config a bare wrangler deploy would use", async () => {
		expect(readDeployTargets(root)).toEqual([]);
		await writeRedirect("../../dist/server/wrangler.json");
		expect(readDeployTargets(root)).toEqual([
			path.join(root, "dist", "server", "wrangler.json"),
		]);
	});

	test("restores a redirect to the deployable build", async () => {
		const original = await writeRedirect("../../dist/server/wrangler.json");
		const restore = snapshotDeployConfig(root);
		await writeRedirect("../../dist-e2e/server/wrangler.json");

		restore();
		restore();

		expect(await readFile(deployConfigPath(root), "utf8")).toBe(original);
	});

	test("keeps a deployable redirect written during the test-auth build", async () => {
		const restore = snapshotDeployConfig(root);
		const deployable = await writeRedirect("../../dist/server/wrangler.json");

		restore();

		expect(await readFile(deployConfigPath(root), "utf8")).toBe(deployable);
	});

	test("removes the redirect when there was none before", async () => {
		const restore = snapshotDeployConfig(root);
		await writeRedirect("../../dist-e2e/server/wrangler.json");

		restore();

		expect(existsSync(deployConfigPath(root))).toBe(false);
	});

	test("does not restore a redirect that named a test-auth build", async () => {
		await writeRedirect("../../dist-e2e/server/wrangler.json");
		const restore = snapshotDeployConfig(root);

		restore();

		expect(existsSync(deployConfigPath(root))).toBe(false);
	});

	test("does not restore a redirect with a test-auth prerender Worker", async () => {
		const file = deployConfigPath(root);
		await mkdir(path.dirname(file), { recursive: true });
		await writeFile(
			file,
			JSON.stringify({
				configPath: "../../dist/server/wrangler.json",
				auxiliaryWorkers: [],
				prerenderWorkerConfigPath: "../../dist-e2e/prerender/wrangler.json",
			}),
		);
		const restore = snapshotDeployConfig(root);

		restore();

		expect(existsSync(file)).toBe(false);
	});

	test("does not restore a redirect to an old test-auth build in dist", async () => {
		await mkdir(path.join(root, "dist", "server"), { recursive: true });
		await writeFile(
			path.join(root, "dist", "server", "middleware.mjs"),
			`const header = "${TEST_AUTH_HEADER}";`,
		);
		await writeRedirect("../../dist/server/wrangler.json");
		const restore = snapshotDeployConfig(root);

		restore();

		expect(existsSync(deployConfigPath(root))).toBe(false);
	});

	test("does not restore an unreadable redirect", async () => {
		const file = deployConfigPath(root);
		await mkdir(path.dirname(file), { recursive: true });
		await writeFile(file, "{");
		const restore = snapshotDeployConfig(root);

		restore();

		expect(existsSync(file)).toBe(false);
	});
});

describe("test-auth build guard", () => {
	const events = ["exit", "SIGINT", "SIGTERM", "SIGHUP"] as const;
	type GuardEvent = (typeof events)[number];
	type Hook = (options?: unknown) => void;
	// Guards started by a test, so a failing test cannot leave listeners behind.
	const started: Record<string, Hook>[] = [];

	afterEach(() => {
		const errors: unknown[] = [];
		withExitRecorded(() => {
			for (const hooks of started.splice(0)) {
				try {
					hooks["astro:build:done"]();
				} catch (error) {
					errors.push(error);
				}
			}
		});
		if (errors.length) throw errors[0];
	});

	// Records process.exit instead of ending the test run, until stopped.
	function recordExits() {
		const exit = process.exit;
		const exits: unknown[] = [];
		process.exit = ((code?: number) => {
			exits.push(code);
		}) as typeof process.exit;
		return { exits, stop: () => (process.exit = exit) };
	}

	function withExitRecorded(fn: () => void) {
		const recording = recordExits();
		try {
			fn();
		} finally {
			recording.stop();
		}
		return recording.exits;
	}

	function listenerCounts() {
		return events.map((event) => process.listenerCount(event));
	}

	function startGuardedBuild() {
		const before = new Map<GuardEvent, unknown[]>();
		for (const event of events) before.set(event, process.listeners(event));
		const countsBefore = listenerCounts();

		const guard = testAuthDeployConfigGuard();
		const hooks = guard.hooks as unknown as Record<string, Hook>;
		hooks["astro:config:done"]({
			config: { root: pathToFileURL(`${root}/`) },
		});
		hooks["astro:build:start"]();
		started.push(hooks);

		function added(event: GuardEvent) {
			const existing = before.get(event) ?? [];
			const listeners = process.listeners(event);
			return listeners.filter((listener) => !existing.includes(listener));
		}

		return { hooks, added, countsBefore };
	}

	test("restores the redirect at build:done and removes its listeners", async () => {
		const original = await writeRedirect("../../dist/server/wrangler.json");
		const build = startGuardedBuild();
		for (const event of events) expect(build.added(event)).toHaveLength(1);
		await writeRedirect("../../dist-e2e/server/wrangler.json");

		build.hooks["astro:build:done"]();

		expect(await readFile(deployConfigPath(root), "utf8")).toBe(original);
		expect(listenerCounts()).toEqual(build.countsBefore);
	});

	test("fails the build when the redirect cannot be restored", async () => {
		await writeRedirect("../../dist/server/wrangler.json");
		const build = startGuardedBuild();
		await rm(deployConfigPath(root));
		await mkdir(deployConfigPath(root));

		expect(() => build.hooks["astro:build:done"]()).toThrow();
		expect(listenerCounts()).toEqual(build.countsBefore);
	});

	test("restores the redirect when the build exits early", async () => {
		const original = await writeRedirect("../../dist/server/wrangler.json");
		const build = startGuardedBuild();
		const [onExit] = build.added("exit");
		await writeRedirect("../../dist-e2e/server/wrangler.json");

		(onExit as () => void)();

		expect(await readFile(deployConfigPath(root), "utf8")).toBe(original);
		expect(listenerCounts()).toEqual(build.countsBefore);
	});

	// Calls the guard's SIGHUP listener with process.kill recorded instead of
	// sent. Other SIGHUP listeners are detached unless keepOthers is set.
	function hangUp(onHangup: (signal: string) => void, keepOthers = false) {
		// Raw listeners keep a once handler's wrapper, so it stays a once handler.
		const others = keepOthers
			? []
			: (process.rawListeners("SIGHUP") as NodeJS.SignalsListener[]).filter(
					(listener) => listener !== onHangup,
				);
		const kill = process.kill;
		const kills: unknown[][] = [];
		try {
			for (const listener of others) process.off("SIGHUP", listener);
			process.kill = ((...args: unknown[]) => {
				kills.push(args);
				return true;
			}) as typeof process.kill;

			onHangup("SIGHUP");
		} finally {
			process.kill = kill;
			for (const listener of others) process.on("SIGHUP", listener);
		}
		return kills;
	}

	test("restores on SIGHUP and then lets the signal end the build", async () => {
		const original = await writeRedirect("../../dist/server/wrangler.json");
		const build = startGuardedBuild();
		const [onHangup] = build.added("SIGHUP");
		await writeRedirect("../../dist-e2e/server/wrangler.json");

		const kills = hangUp(onHangup as (signal: string) => void);

		expect(kills).toEqual([[process.pid, "SIGHUP"]]);
		expect(await readFile(deployConfigPath(root), "utf8")).toBe(original);
		expect(listenerCounts()).toEqual(build.countsBefore);
	});

	test("restores and stays armed when another handler owns the signal", async () => {
		const original = await writeRedirect("../../dist/server/wrangler.json");
		const other = () => {};
		process.on("SIGHUP", other);
		// The guard's grace timer must not end the test run.
		const recording = recordExits();
		try {
			const build = startGuardedBuild();
			const [onHangup] = build.added("SIGHUP");
			await writeRedirect("../../dist-e2e/server/wrangler.json");

			expect(hangUp(onHangup as (signal: string) => void, true)).toEqual([]);

			expect(await readFile(deployConfigPath(root), "utf8")).toBe(original);
			expect(build.added("exit")).toHaveLength(1);

			await writeRedirect("../../dist-e2e/server/wrangler.json");
			build.hooks["astro:build:done"]();

			// The build ends with the hangup it got, as it would without the guard.
			expect(recording.exits).toEqual([129]);
			expect(await readFile(deployConfigPath(root), "utf8")).toBe(original);
			expect(listenerCounts()).toEqual(build.countsBefore);
		} finally {
			recording.stop();
			process.off("SIGHUP", other);
		}
	});

	test("leaves shutdown to a once handler registered before the build", async () => {
		const original = await writeRedirect("../../dist/server/wrangler.json");
		let otherCalls = 0;
		const other = () => {
			otherCalls += 1;
		};
		process.once("SIGHUP", other);
		const recording = recordExits();
		try {
			const build = startGuardedBuild();
			const [onHangup] = build.added("SIGHUP");
			await writeRedirect("../../dist-e2e/server/wrangler.json");

			// The guard runs first, before the once wrapper removes itself.
			const raw = process.rawListeners("SIGHUP") as ((s: string) => void)[];
			expect(raw[0]).toBe(onHangup);
			const onceWrapper = raw.find(
				(listener) => (listener as { listener?: unknown }).listener === other,
			);
			const kills = hangUp(onHangup as (signal: string) => void, true);
			onceWrapper?.("SIGHUP");

			expect(otherCalls).toBe(1);
			expect(kills).toEqual([]);
			expect(await readFile(deployConfigPath(root), "utf8")).toBe(original);
			build.hooks["astro:build:done"]();
			expect(recording.exits).toEqual([129]);
		} finally {
			recording.stop();
			process.off("SIGHUP", other);
		}
	});
});

describe("test-auth bundle markers", () => {
	test("finds the test-auth header in nested bundle files", async () => {
		await mkdir(path.join(root, "chunks"), { recursive: true });
		await writeFile(path.join(root, "entry.mjs"), "export default {};");
		await writeFile(
			path.join(root, "chunks", "auth.mjs"),
			`const header = "${TEST_AUTH_HEADER}";`,
		);

		expect(findTestAuthMarkers(root)).toEqual([
			path.join(root, "chunks", "auth.mjs"),
		]);
	});

	test("finds the header name in any case", async () => {
		await writeFile(
			path.join(root, "entry.mjs"),
			`headers.get("${TEST_AUTH_HEADER.toLowerCase()}");`,
		);

		expect(findTestAuthMarkers(root)).toEqual([path.join(root, "entry.mjs")]);
	});

	test("follows a symlink to a bundle file", async () => {
		await mkdir(path.join(root, "linked"), { recursive: true });
		const target = path.join(root, "linked", "auth.mjs");
		await writeFile(target, `const header = "${TEST_AUTH_HEADER}";`);
		await mkdir(path.join(root, "bundle"), { recursive: true });
		await symlink(target, path.join(root, "bundle", "auth.mjs"));

		expect(findTestAuthMarkers(path.join(root, "bundle"))).toEqual([
			path.join(root, "bundle", "auth.mjs"),
		]);
	});

	test("refuses a symlinked directory it cannot scan", async () => {
		await mkdir(path.join(root, "shared"), { recursive: true });
		await mkdir(path.join(root, "bundle"), { recursive: true });
		const link = path.join(root, "bundle", "chunks");
		await symlink(path.join(root, "shared"), link);

		expect(() => findTestAuthMarkers(path.join(root, "bundle"))).toThrow(
			/links to a directory/,
		);
	});

	test("passes a bundle without the header", async () => {
		await writeFile(path.join(root, "entry.mjs"), "export default {};");

		expect(findTestAuthMarkers(root)).toEqual([]);
	});
});
