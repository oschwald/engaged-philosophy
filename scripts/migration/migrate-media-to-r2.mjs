import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { DEFAULT_MIGRATION_SEED_PATH } from "./lib/migration-seed-path.mjs";
import {
	DEFAULT_WORDPRESS_SITE_URL,
	uploadStorageKeyFromUrl,
} from "./lib/wordpress-media.mjs";

const ROOT = process.cwd();
const DEFAULT_SEED_PATH = DEFAULT_MIGRATION_SEED_PATH;
const DEFAULT_SITE_URL = DEFAULT_WORDPRESS_SITE_URL;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_WRANGLER_CONFIG = path.join(ROOT, "wrangler.jsonc");
const DEFAULT_PUBLIC_MEDIA_URL = "https://media.engagedphilosophy.com";
const UPLOAD_URL_RE =
	/https?:\/\/[^"'()\s<>]+|(?:^|[\s"'(=])(\/wp-content\/uploads\/[^"'()\s<>]+)/gi;
const DOWNLOAD_RETRIES = 3;

function printUsage() {
	console.log(`Usage: npm run migrate:media -- [options]

Options:
  --bucket <name>         R2 bucket name. Defaults to the first bucket in wrangler.jsonc.
  --seed <path>           Seed file to scan. Default: .migration/seed.json
  --site-url <url>        Base URL for relative uploads. Default: ${DEFAULT_SITE_URL}
  --concurrency <number>  Parallel downloads/uploads. Default: ${DEFAULT_CONCURRENCY}
  --limit <number>        Stop after N files.
  --match <text>          Only migrate URLs containing the given text.
  --skip-existing         Skip objects already reachable at the public media URL.
  --public-media-url <url> Public media base URL for --skip-existing. Defaults to PUBLIC_MEDIA_URL in wrangler.jsonc.
  --dry-run               Print the migration plan without uploading.
  --help                  Show this help message.
`);
}

function parseArgs(argv) {
	const options = {
		seedPath: DEFAULT_SEED_PATH,
		siteUrl: DEFAULT_SITE_URL,
		concurrency: DEFAULT_CONCURRENCY,
		dryRun: false,
		limit: undefined,
		match: "",
		bucket: "",
		skipExisting: false,
		publicMediaUrl: "",
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--help") {
			options.help = true;
			continue;
		}
		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (arg === "--skip-existing") {
			options.skipExisting = true;
			continue;
		}
		if (
			arg === "--bucket" ||
			arg === "--seed" ||
			arg === "--site-url" ||
			arg === "--concurrency" ||
			arg === "--limit" ||
			arg === "--match" ||
			arg === "--public-media-url"
		) {
			const value = argv[index + 1];
			if (!value) {
				throw new Error(`Missing value for ${arg}`);
			}
			index += 1;
			if (arg === "--bucket") options.bucket = value;
			if (arg === "--seed") options.seedPath = path.resolve(ROOT, value);
			if (arg === "--site-url") options.siteUrl = value;
			if (arg === "--concurrency") {
				const concurrency = Number.parseInt(value, 10);
				if (!Number.isInteger(concurrency) || concurrency < 1) {
					throw new Error(`Invalid concurrency: ${value}`);
				}
				options.concurrency = concurrency;
			}
			if (arg === "--limit") {
				const limit = Number.parseInt(value, 10);
				if (!Number.isInteger(limit) || limit < 1) {
					throw new Error(`Invalid limit: ${value}`);
				}
				options.limit = limit;
			}
			if (arg === "--match") options.match = value;
			if (arg === "--public-media-url") options.publicMediaUrl = value;
			continue;
		}

		throw new Error(`Unknown argument: ${arg}`);
	}

	return options;
}

function walkStrings(value, visit) {
	if (typeof value === "string") {
		visit(value);
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) walkStrings(item, visit);
		return;
	}
	if (value && typeof value === "object") {
		for (const item of Object.values(value)) walkStrings(item, visit);
	}
}

function normalizeUploadUrl(rawValue, siteUrl) {
	const trimmed = rawValue.trim();
	const key = uploadStorageKeyFromUrl(trimmed, siteUrl);
	if (!key) return null;
	const absoluteUrl = trimmed.startsWith("/wp-content/uploads/")
		? new URL(trimmed, siteUrl).toString()
		: trimmed;
	return {
		absoluteUrl,
		key,
	};
}

async function getBucketName(explicitBucket) {
	if (explicitBucket) return explicitBucket;
	const config = await readFile(DEFAULT_WRANGLER_CONFIG, "utf8");
	const match = config.match(
		/"r2_buckets"\s*:\s*\[[\s\S]*?"bucket_name"\s*:\s*"([^"]+)"/,
	);
	if (!match) {
		throw new Error(
			"Could not determine an R2 bucket from wrangler.jsonc. Pass --bucket.",
		);
	}
	return match[1];
}

async function getPublicMediaUrl(explicitUrl) {
	if (explicitUrl) return explicitUrl.replace(/\/+$/, "");
	if (process.env.PUBLIC_MEDIA_URL) {
		return process.env.PUBLIC_MEDIA_URL.replace(/\/+$/, "");
	}

	const config = await readFile(DEFAULT_WRANGLER_CONFIG, "utf8");
	const match = config.match(/"PUBLIC_MEDIA_URL"\s*:\s*"([^"]+)"/);
	return (match?.[1] || DEFAULT_PUBLIC_MEDIA_URL).replace(/\/+$/, "");
}

async function collectUploadTargets(seedPath, siteUrl, matchText) {
	const seed = JSON.parse(await readFile(seedPath, "utf8"));
	const targets = new Map();

	walkStrings(seed, (value) => {
		for (const match of value.matchAll(UPLOAD_URL_RE)) {
			const rawValue = match[1] || match[0];
			const normalized = normalizeUploadUrl(rawValue, siteUrl);
			if (!normalized) continue;
			if (matchText && !normalized.absoluteUrl.includes(matchText)) continue;
			targets.set(normalized.key, normalized.absoluteUrl);
		}
	});

	return [...targets.entries()]
		.sort((left, right) => left[0].localeCompare(right[0]))
		.map(([key, absoluteUrl]) => ({ key, absoluteUrl }));
}

function runCommand(command, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: ROOT,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve({ stdout, stderr });
				return;
			}
			reject(
				new Error(
					`${command} ${args.join(" ")} failed with exit code ${code}\n${stderr || stdout}`,
				),
			);
		});
	});
}

async function downloadFile(url, filePath) {
	let lastError = null;

	for (let attempt = 1; attempt <= DOWNLOAD_RETRIES; attempt += 1) {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(
					`Download failed with ${response.status} ${response.statusText}`,
				);
			}
			const arrayBuffer = await response.arrayBuffer();
			await writeFile(filePath, Buffer.from(arrayBuffer));
			return response.headers.get("content-type") ?? "";
		} catch (error) {
			lastError = error;
			if (attempt === DOWNLOAD_RETRIES) break;
			await new Promise((resolve) => {
				setTimeout(resolve, attempt * 1_000);
			});
		}
	}

	throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function uploadFile(bucket, key, filePath, contentType) {
	const args = [
		"wrangler",
		"r2",
		"object",
		"put",
		`${bucket}/${key}`,
		"--remote",
		"--file",
		filePath,
	];
	if (contentType) {
		args.push("--content-type", contentType);
	}
	await runCommand("npx", args);
}

function publicObjectUrl(publicMediaUrl, key) {
	return `${publicMediaUrl}/${key
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/")}`;
}

async function objectExists(publicMediaUrl, key) {
	const url = publicObjectUrl(publicMediaUrl, key);
	try {
		const head = await fetch(url, { method: "HEAD" });
		if (head.ok) return true;
		if (head.status !== 405) return false;

		const ranged = await fetch(url, {
			headers: { Range: "bytes=0-0" },
		});
		return ranged.ok || ranged.status === 206;
	} catch {
		return false;
	}
}

async function runPool(items, concurrency, worker) {
	const queue = [...items];
	const workers = Array.from(
		{ length: Math.min(concurrency, queue.length) },
		async () => {
			while (queue.length > 0) {
				const item = queue.shift();
				if (!item) return;
				await worker(item);
			}
		},
	);
	await Promise.all(workers);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printUsage();
		return;
	}

	const bucket = await getBucketName(options.bucket);
	const publicMediaUrl = await getPublicMediaUrl(options.publicMediaUrl);
	let targets = await collectUploadTargets(
		options.seedPath,
		options.siteUrl,
		options.match,
	);
	if (options.limit) {
		targets = targets.slice(0, options.limit);
	}

	if (targets.length === 0) {
		console.log("No upload URLs found.");
		return;
	}

	console.log(
		`${options.dryRun ? "Planning" : "Migrating"} ${targets.length} objects to R2 bucket "${bucket}"`,
	);
	console.log(`Source seed: ${path.relative(ROOT, options.seedPath)}`);
	console.log(`Sample key: ${targets[0].key}`);
	if (options.skipExisting) {
		console.log(`Skipping existing objects via ${publicMediaUrl}`);
	}

	if (options.dryRun) {
		for (const target of targets.slice(0, 20)) {
			console.log(`${target.absoluteUrl} -> r2://${bucket}/${target.key}`);
		}
		if (targets.length > 20) {
			console.log(`...and ${targets.length - 20} more`);
		}
		return;
	}

	const tempDir = await mkdtemp(path.join(os.tmpdir(), "engaged-media-"));
	const failures = [];
	let processed = 0;
	let uploaded = 0;
	let skipped = 0;

	try {
		await runPool(targets, options.concurrency, async (target) => {
			const tempFile = path.join(tempDir, target.key.replace(/[\\/]/g, "__"));
			try {
				if (
					options.skipExisting &&
					(await objectExists(publicMediaUrl, target.key))
				) {
					processed += 1;
					skipped += 1;
					console.log(`[${processed}/${targets.length}] skipped ${target.key}`);
					return;
				}

				const contentType = await downloadFile(target.absoluteUrl, tempFile);
				await uploadFile(bucket, target.key, tempFile, contentType);
				processed += 1;
				uploaded += 1;
				console.log(`[${processed}/${targets.length}] uploaded ${target.key}`);
			} catch (error) {
				failures.push({
					key: target.key,
					url: target.absoluteUrl,
					error: error instanceof Error ? error.message : String(error),
				});
				console.error(`Failed: ${target.key}`);
			} finally {
				await rm(tempFile, { force: true });
			}
		});
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}

	if (failures.length > 0) {
		console.error(
			`\nMigration finished with ${failures.length} failure(s). First failure:\n${JSON.stringify(failures[0], null, 2)}`,
		);
		process.exitCode = 1;
		return;
	}

	console.log(
		`\nMigration finished successfully. Uploaded ${uploaded} objects, skipped ${skipped} existing objects.`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
