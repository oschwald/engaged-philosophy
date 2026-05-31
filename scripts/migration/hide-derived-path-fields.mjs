import { spawnSync } from "node:child_process";
import process from "node:process";

const DATABASE_NAME = "engaged-philosophy";
const args = process.argv.slice(2);
const mode = args.includes("--remote")
	? "--remote"
	: args.includes("--local")
		? "--local"
		: "--local";
const remoteConfirmed =
	args.includes("--confirm") &&
	args[args.indexOf("--confirm") + 1] === "remote";

if (mode === "--remote" && !remoteConfirmed) {
	console.error(
		"Refusing to update remote D1 schema without --confirm remote.",
	);
	process.exit(1);
}

function runWrangler(command) {
	const result = spawnSync(
		"npx",
		[
			"wrangler",
			"d1",
			"execute",
			DATABASE_NAME,
			"--json",
			mode,
			"--command",
			command,
		],
		{
			cwd: process.cwd(),
			encoding: "utf8",
			maxBuffer: 32 * 1024 * 1024,
		},
	);

	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(
			result.stderr || result.stdout || "wrangler d1 execute failed",
		);
	}

	const raw = result.stdout.trim();
	return raw ? JSON.parse(raw) : [];
}

runWrangler(`
	UPDATE _emdash_fields
	SET required = 0,
		widget = 'legacy-image-blocks:hidden'
	WHERE slug = 'path'
		AND collection_id IN (
			SELECT id
			FROM _emdash_collections
			WHERE slug IN ('pages', 'posts', 'projects')
		);
`);

const result = runWrangler(`
	SELECT c.slug AS collection, f.slug, f.required, f.widget
	FROM _emdash_fields f
	INNER JOIN _emdash_collections c ON c.id = f.collection_id
	WHERE f.slug = 'path'
		AND c.slug IN ('pages', 'posts', 'projects')
	ORDER BY c.slug;
`);

console.log(
	JSON.stringify(
		{
			mode: mode.slice(2),
			fields: result[0]?.results ?? [],
		},
		null,
		2,
	),
);
