#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import seed from "../seed/seed.json" with { type: "json" };

const PORT = "8791";
const BASE_URL = `http://127.0.0.1:${PORT}`;

function parseArgs(argv) {
	const options = { dir: "" };
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		const next = argv[i + 1];
		if (arg === "--dir" && next) {
			options.dir = next;
			i += 1;
		}
	}
	return options;
}

function normalizePath(inputPath) {
	if (!inputPath) return "/";
	let value = inputPath.replace(/https?:\/\/[^/]+/i, "");
	try {
		value = decodeURIComponent(value);
	} catch {}
	if (!value.startsWith("/")) value = `/${value}`;
	value = value.replace(/\/+/g, "/");
	if (value !== "/" && value.endsWith("/index.html"))
		value = value.slice(0, -10);
	if (value !== "/" && !value.endsWith("/")) value = `${value}/`;
	return value;
}

function getSeedRoutes() {
	const routes = new Set(["/", "/blog/", "/project/"]);
	for (const page of seed.content.pages ?? []) {
		if (page.status === "published") {
			routes.add(normalizePath(page.data.path || "/"));
		}
	}
	for (const post of seed.content.posts ?? []) {
		if (post.status === "published") {
			routes.add(normalizePath(post.data.path));
		}
	}
	for (const project of seed.content.projects ?? []) {
		if (project.status === "published") {
			routes.add(normalizePath(project.data.path));
		}
	}
	for (const taxonomy of seed.taxonomies ?? []) {
		if (
			!["topic", "schools", "professors", "courses", "semesters"].includes(
				taxonomy.name,
			)
		) {
			continue;
		}
		for (const term of taxonomy.terms ?? []) {
			routes.add(normalizePath(`/${taxonomy.name}/${term.slug}/`));
		}
	}
	return [...routes].sort();
}

async function waitUrl(url, timeoutMs = 25000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(url);
			if (res.status === 200) return true;
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	return false;
}

async function run() {
	const options = parseArgs(process.argv.slice(2));
	if (!options.dir) {
		console.error("Error: --dir <target_directory> is required");
		process.exit(1);
	}

	const targetDir = path.resolve(options.dir);
	fs.mkdirSync(targetDir, { recursive: true });

	const routes = getSeedRoutes();
	console.log(`Found ${routes.length} routes to snapshot.`);

	console.log(`Starting Astro dev server on port ${PORT}...`);
	const server = spawn("npx", ["astro", "dev", "--port", PORT], {
		stdio: "pipe",
		shell: true,
	});

	let serverOutput = "";
	server.stdout.on("data", (data) => {
		serverOutput += data.toString();
	});
	server.stderr.on("data", (data) => {
		serverOutput += data.toString();
	});

	// Wait for server to be ready
	const ready = await waitUrl(BASE_URL);
	if (!ready) {
		console.error("Error: Astro dev server failed to start within timeout.");
		console.error("Server output:");
		console.error(serverOutput);
		server.kill();
		process.exit(1);
	}
	console.log("Server is ready. Starting snapshots...");

	let successCount = 0;
	let failCount = 0;

	for (const route of routes) {
		try {
			const res = await fetch(`${BASE_URL}${route}`);
			const html = await res.text();

			// Clean dynamic attributes/scripts to make strict diff comparisons clean
			// Strip out inline Vite client/server scripts, live reload tokens, etc.
			const cleanedHtml = html
				.replace(/<script type="module" src="\/@fs\/[^"]+"><\/script>/g, "")
				.replace(/<script[^>]*src="\/@vite\/client"[^>]*><\/script>/g, "")
				.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, (match) => {
					// Keep theme styles but strip Vite/Astro dev hot reload styling tags if any
					if (
						match.includes("astro-dev-toolbar") ||
						match.includes("vite-legacy-entry")
					)
						return "";
					return match;
				})
				.replace(/<!--[\s\S]*?-->/g, "");

			// Construct file path
			const filename = route === "/" ? "/index.html" : `${route}index.html`;
			const filepath = path.join(targetDir, filename);
			fs.mkdirSync(path.dirname(filepath), { recursive: true });
			fs.writeFileSync(filepath, cleanedHtml, "utf8");
			successCount += 1;
		} catch (err) {
			console.error(`Failed to fetch ${route}:`, err.message);
			failCount += 1;
		}
	}

	console.log(
		`Snapshot completed. Success: ${successCount}, Failed: ${failCount}`,
	);
	console.log("Stopping Astro dev server...");
	server.kill();
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
