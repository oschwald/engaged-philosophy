#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";

const DIR_BEFORE = path.resolve(".snapshot/before");
const DIR_AFTER = path.resolve(".snapshot/after");

function getFiles(dir, fileList = []) {
	const files = fs.readdirSync(dir);
	for (const file of files) {
		const name = path.join(dir, file);
		if (fs.statSync(name).isDirectory()) {
			getFiles(name, fileList);
		} else if (file.endsWith(".html")) {
			fileList.push(name);
		}
	}
	return fileList;
}

function cleanBodyHtml(html) {
	const $ = load(html);

	// We only care about the actual content body inside #page (which wraps header, main, footer)
	const pageContent = $("#page");
	if (!pageContent.length) {
		return $("body").html() || "";
	}

	// Remove dynamic attributes/values that Vite/Astro injects
	pageContent.find("script").remove();
	pageContent.find("style").remove();

	let cleaned = pageContent.html() || "";

	// Normalize spaces, newlines, and quotes
	cleaned = cleaned.replace(/\s+/g, " ").replace(/"/g, "'").trim();

	return cleaned;
}

function run() {
	if (!fs.existsSync(DIR_BEFORE) || !fs.existsSync(DIR_AFTER)) {
		console.error(
			"Error: snapshot directories .snapshot/before or .snapshot/after do not exist",
		);
		process.exit(1);
	}

	const beforeFiles = getFiles(DIR_BEFORE);
	console.log(`Comparing body HTML of ${beforeFiles.length} snapshot files...`);

	let diffCount = 0;

	for (const beforeFile of beforeFiles) {
		const relativePath = path.relative(DIR_BEFORE, beforeFile);
		const afterFile = path.join(DIR_AFTER, relativePath);

		if (!fs.existsSync(afterFile)) {
			console.log(`Missing in 'after': ${relativePath}`);
			diffCount += 1;
			continue;
		}

		const beforeHtml = fs.readFileSync(beforeFile, "utf8");
		const afterHtml = fs.readFileSync(afterFile, "utf8");

		const beforeBody = cleanBodyHtml(beforeHtml);
		const afterBody = cleanBodyHtml(afterHtml);

		if (beforeBody !== afterBody) {
			console.log(`\nDiff found in: ${relativePath}`);
			// Print a small context of the differences if possible, or just note it
			console.log("BEFORE length:", beforeBody.length);
			console.log("AFTER length:", afterBody.length);

			// Show first difference
			let diffIndex = -1;
			for (let i = 0; i < Math.min(beforeBody.length, afterBody.length); i++) {
				if (beforeBody[i] !== afterBody[i]) {
					diffIndex = i;
					break;
				}
			}
			if (diffIndex !== -1) {
				console.log("Difference starts at index:", diffIndex);
				console.log(
					"BEFORE context:",
					beforeBody.slice(Math.max(0, diffIndex - 40), diffIndex + 100),
				);
				console.log(
					"AFTER context: ",
					afterBody.slice(Math.max(0, diffIndex - 40), diffIndex + 100),
				);
			}

			diffCount += 1;
		}
	}

	if (diffCount === 0) {
		console.log(
			"\nSUCCESS: All page content bodies match exactly! No regressions or functional changes found.",
		);
	} else {
		console.log(
			`\nCompleted with ${diffCount} differences in page content bodies.`,
		);
	}
}

run();
