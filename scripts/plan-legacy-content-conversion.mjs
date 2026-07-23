#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";

import {
	convertBackup,
	formatConversionPlan,
} from "./lib/legacy-content-conversion.mjs";

const usage = `Usage: pnpm run plan:legacy-content-conversion -- --input <backup.json> [--json]

Plan safe legacy Portable Text conversions against a downloaded EmDash backup.
The command is read-only, emits no content body text, and writes only to stdout.

Options:
  --input <backup.json>  EmDash backup downloaded from the admin UI
  --json                 Emit a deterministic JSON report
  --help                 Show this help`;

function parseArguments(args) {
	let input;
	let json = false;
	let help = false;

	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--") {
			continue;
		} else if (argument === "--input") {
			input = args[index + 1];
			index += 1;
			if (!input) throw new Error("--input requires a file path.");
		} else if (argument === "--json") {
			json = true;
		} else if (argument === "--help" || argument === "-h") {
			help = true;
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}

	if (!help && !input) throw new Error("--input is required.");
	return { input, json, help };
}

async function main() {
	try {
		const options = parseArguments(process.argv.slice(2));
		if (options.help) {
			process.stdout.write(`${usage}\n`);
			return;
		}

		let backup;
		try {
			backup = JSON.parse(await readFile(options.input, "utf8"));
		} catch (error) {
			throw new Error(
				`Could not read a valid JSON backup: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}

		const { report } = convertBackup(backup);
		process.stdout.write(
			options.json
				? `${JSON.stringify(report, null, 2)}\n`
				: formatConversionPlan(report),
		);
	} catch (error) {
		process.stderr.write(
			`Error: ${error instanceof Error ? error.message : String(error)}\n\n${usage}\n`,
		);
		process.exitCode = 1;
	}
}

await main();
