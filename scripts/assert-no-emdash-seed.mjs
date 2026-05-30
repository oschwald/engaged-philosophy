import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const forbiddenSeedPaths = [
	path.join(root, "seed", "seed.json"),
	path.join(root, ".emdash", "seed.json"),
];

const present = forbiddenSeedPaths.filter((seedPath) =>
	fs.existsSync(seedPath),
);

if (present.length > 0) {
	console.error(
		[
			"Production builds must not include EmDash auto-discovered seed files.",
			"Move migration data to .migration/seed.json before building.",
			"",
			"Found:",
			...present.map((seedPath) => `- ${path.relative(root, seedPath)}`),
		].join("\n"),
	);
	process.exit(1);
}
