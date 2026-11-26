import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { constants } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Test-auth builds trust this header as an admin login. A deployable bundle must
// never contain it. Keep in sync with src/lib/test-auth.ts.
export const TEST_AUTH_HEADER = "X-EmDash-Test-Auth";
export const TEST_AUTH_ENV_VARS = [
	"EMDASH_TEST_AUTH",
	"EMDASH_ALLOW_TEST_AUTH",
];
export const BUILD_OUT_DIR = "dist";
// Test-auth builds go to their own directory so they never replace the
// deployable build in dist/.
export const TEST_AUTH_OUT_DIR = "dist-e2e";

/** @param {NodeJS.ProcessEnv} [env] */
export function isTestAuthBuild(env = process.env) {
	return env.EMDASH_TEST_AUTH === "1";
}

/** @param {NodeJS.ProcessEnv} [env] */
export function buildOutDir(env = process.env) {
	return isTestAuthBuild(env) ? TEST_AUTH_OUT_DIR : BUILD_OUT_DIR;
}

/**
 * Names of test-auth variables present with any value. A deployable build and
 * its checks must have none.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function presentTestAuthEnvVars(env = process.env) {
	return TEST_AUTH_ENV_VARS.filter((name) => env[name] !== undefined);
}

/** @param {NodeJS.ProcessEnv} [env] */
export function assertNoTestAuthEnv(env = process.env) {
	const names = presentTestAuthEnvVars(env);
	if (names.length) {
		throw new Error(
			`Unset ${names.join(", ")} to build, check or deploy a deployable Worker.`,
		);
	}
}

/** @param {string} root */
export function deployConfigPath(root) {
	return path.join(root, ".wrangler", "deploy", "config.json");
}

/**
 * Worker config paths that a Wrangler deploy redirect file names, resolved to
 * absolute paths. Throws if the file is not a redirect Wrangler could follow.
 * @param {string} file
 * @param {string} contents
 */
function redirectTargets(file, contents) {
	let config;
	try {
		config = JSON.parse(contents);
	} catch (error) {
		throw new Error(`${file} is not valid JSON. Run pnpm run build again.`, {
			cause: error,
		});
	}
	if (typeof config?.configPath !== "string") {
		throw new Error(`${file} has no configPath`);
	}

	const configPaths = [
		config.configPath,
		config.prerenderWorkerConfigPath,
		...(Array.isArray(config.auxiliaryWorkers)
			? config.auxiliaryWorkers.map((worker) => worker?.configPath)
			: []),
	];

	return configPaths
		.filter((configPath) => typeof configPath === "string")
		.map((configPath) => path.resolve(path.dirname(file), configPath));
}

/**
 * Every Worker config that the deploy redirect names, entry Worker first, or
 * an empty list when there is no redirect file. The entry Worker is the one a
 * bare `wrangler deploy` would publish.
 * @param {string} root
 */
export function readDeployTargets(root) {
	const file = deployConfigPath(root);
	if (!existsSync(file)) return [];
	return redirectTargets(file, readFileSync(file, "utf8"));
}

/**
 * @param {string} child
 * @param {string} parent
 */
function isInside(child, parent) {
	const relative = path.relative(parent, child);
	return (
		relative === "" ||
		(relative !== ".." &&
			!relative.startsWith(`..${path.sep}`) &&
			!path.isAbsolute(relative))
	);
}

/**
 * @param {string} root
 * @param {string} file
 */
export function isInTestAuthOutput(root, file) {
	return isInside(path.resolve(file), path.join(root, TEST_AUTH_OUT_DIR));
}

/**
 * The Cloudflare Vite plugin points `.wrangler/deploy/config.json` at the
 * latest build, so a bare `wrangler deploy` would publish a test-auth build.
 * Call this before a test-auth build. The returned function puts back the
 * earlier redirect, or removes the file when there was none or it named a
 * test-auth build, either in dist-e2e/ or one left in dist/ by an older e2e
 * run. It is safe to call more than once.
 * @param {string} root
 */
export function snapshotDeployConfig(root) {
	const file = deployConfigPath(root);
	const saved = readIfExists(file);

	return function restoreDeployConfig() {
		// A deployable build that ran meanwhile may have written its own
		// redirect. Leave that one alone.
		const current = readIfExists(file);
		if (current !== null && !namesTestAuthBuild(root, file, current)) return;

		// When current equals saved, it was just found to name a test-auth build.
		const restorable =
			saved !== null &&
			saved !== current &&
			!namesTestAuthBuild(root, file, saved);
		if (restorable) {
			mkdirSync(path.dirname(file), { recursive: true });
			writeFileSync(file, saved);
		} else {
			rmSync(file, { force: true });
		}
	};
}

/** @param {string} file */
function readIfExists(file) {
	try {
		return readFileSync(file, "utf8");
	} catch (error) {
		if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") {
			return null;
		}
		throw error;
	}
}

/**
 * Whether a redirect names a test-auth build: one in dist-e2e/, or one left in
 * dist/ by an older e2e run. A redirect that cannot be read or checked counts
 * too, so it is never put back unchecked.
 * @param {string} root
 * @param {string} file
 * @param {string} contents
 */
function namesTestAuthBuild(root, file, contents) {
	try {
		const targets = redirectTargets(file, contents);
		if (targets.some((target) => isInTestAuthOutput(root, target))) {
			return true;
		}

		const dirs = new Set(targets.map((target) => path.dirname(target)));
		return [...dirs].some(
			(dir) => existsSync(dir) && findTestAuthMarkers(dir).length > 0,
		);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		console.warn(`Not keeping ${file}, because it could not be checked.`);
		console.warn(reason);
		return true;
	}
}

const RESTORE_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];
// How long other signal handlers get to finish before the guard ends the build.
const SIGNAL_EXIT_GRACE_MS = 5000;

/**
 * Astro integration for test-auth builds. It restores the deploy redirect when
 * the build finishes, fails, or gets SIGINT, SIGTERM or SIGHUP. When another
 * handler also listens for the signal, the guard leaves shutdown to it but
 * ends the build after a grace period, so two handlers that each wait for the
 * other cannot keep it running. Because the guard listens for these signals,
 * a build that inherited them as ignored, as under nohup or as a background
 * job of a script, now ends on them too. SIGKILL and SIGQUIT can still leave
 * the redirect on the test-auth output; the bundle check in `pnpm run deploy`
 * catches that.
 * @returns {import("astro").AstroIntegration}
 */
export function testAuthDeployConfigGuard() {
	/** @type {string | null} */
	let root = null;
	/** @type {(() => void) | null} */
	let restore = null;
	/** @type {NodeJS.Timeout | undefined} */
	let exitTimer;
	// A signal that another handler took over. The build still ends with it.
	/** @type {NodeJS.Signals | undefined} */
	let pendingSignal;
	// Errors here would escape a signal or exit handler, so report them instead.
	const tryRestore = (/** @type {(() => void) | null} */ fn) => {
		try {
			fn?.();
		} catch (error) {
			console.error("Could not restore .wrangler/deploy/config.json:", error);
		}
	};
	/**
	 * @param {boolean} [strict] Throw restore errors instead of logging them.
	 * @returns {number | undefined} The exit code of a pending signal.
	 */
	const finish = (strict = false) => {
		process.off("exit", onExit);
		for (const signal of RESTORE_SIGNALS) process.off(signal, onSignal);
		clearTimeout(exitTimer);
		exitTimer = undefined;
		const pending = restore;
		restore = null;
		if (strict) pending?.();
		else tryRestore(pending);

		const signal = pendingSignal;
		pendingSignal = undefined;
		return signal && 128 + (constants.signals[signal] ?? 0);
	};
	/** @param {number} code */
	function onExit(code) {
		const signalCode = finish();
		if (signalCode !== undefined && code === 0) process.exitCode = signalCode;
	}
	/** @param {NodeJS.Signals} signal */
	function onSignal(signal) {
		if (process.listenerCount(signal) > 1) {
			// Another handler owns shutdown. Restore now and stay armed for exit.
			// If the build is still running after a grace period, because each
			// handler left exiting to the others, stop it as the signal would.
			tryRestore(restore);
			pendingSignal ??= signal;
			exitTimer ??= setTimeout(() => {
				process.exit(finish());
			}, SIGNAL_EXIT_GRACE_MS).unref();
			return;
		}

		// No other handler: restore, then keep the default signal behavior.
		// Windows cannot send itself every signal, so exit as the signal would.
		const code = 128 + (constants.signals[signal] ?? 0);
		finish();
		try {
			process.kill(process.pid, signal);
		} catch {
			process.exit(code);
		}
	}

	return {
		name: "engaged-philosophy-test-auth-deploy-config-guard",
		hooks: {
			"astro:config:done": ({ config }) => {
				root = fileURLToPath(config.root);
			},
			"astro:build:start": () => {
				if (!root) throw new Error("Astro root is not resolved.");
				restore = snapshotDeployConfig(root);
				process.on("exit", onExit);
				// Prepend, so a `once` handler has not yet removed itself when the
				// guard counts listeners.
				for (const signal of RESTORE_SIGNALS) {
					process.prependListener(signal, onSignal);
				}
			},
			"astro:build:done": () => {
				// A failed restore fails the build. A signal that arrived during the
				// build still ends it.
				const signalCode = finish(true);
				if (signalCode !== undefined) process.exit(signalCode);
			},
		},
	};
}

/**
 * Files under `dir` that contain the test-auth header. Synchronous so the
 * guard can use it from an exit handler.
 * @param {string} dir
 * @returns {string[]}
 */
export function findTestAuthMarkers(dir) {
	/** @type {string[]} */
	const matches = [];
	const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
	for (const entry of entries) {
		const file = path.join(entry.parentPath, entry.name);
		if (entry.isSymbolicLink() && !isLinkedFile(file)) continue;
		if (!entry.isFile() && !entry.isSymbolicLink()) continue;
		// Header names are case-insensitive, so match the name in any case.
		const text = readFileSync(file, "latin1").toLowerCase();
		if (text.includes(TEST_AUTH_HEADER.toLowerCase())) {
			matches.push(file);
		}
	}

	return matches.sort();
}

/**
 * Whether a symlink points at a file to scan. A dangling link has nothing to
 * read. A linked directory is not followed, so refuse it rather than pass it.
 * @param {string} link
 */
function isLinkedFile(link) {
	let stats;
	try {
		stats = statSync(link);
	} catch {
		return false;
	}
	if (stats.isDirectory()) {
		throw new Error(`${link} links to a directory the test-auth scan skips.`);
	}
	return stats.isFile();
}
