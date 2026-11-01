import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

import {
	ContentRepository,
	OptionsRepository,
	runWithContext,
	SchemaRegistry,
	type Database,
} from "emdash";
import { runMigrations } from "emdash/db";
import { createDialect } from "emdash/db/sqlite";
import { emdashLoader } from "emdash/runtime";
import { CompiledQuery, Kysely } from "kysely";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "vitest";

describe("public query indexes", () => {
	let db: Kysely<Database>;
	let queries: CompiledQuery[];
	let hooks: ReturnType<typeof registerHooks>;

	beforeAll(() => {
		// The published loader imports Astro's config even with an explicit database.
		hooks = registerHooks({
			resolve(specifier, context, nextResolve) {
				if (specifier === "virtual:emdash/config") {
					return {
						url: "data:text/javascript,export default {}",
						shortCircuit: true,
					};
				}
				return nextResolve(specifier, context);
			},
		});
	});

	afterAll(() => hooks.deregister());

	beforeEach(async () => {
		queries = [];
		db = new Kysely<Database>({
			dialect: createDialect({ url: ":memory:" }),
			log(event) {
				if (event.level === "query") queries.push(event.query);
			},
		});
		await runMigrations(db);
		const schema = new SchemaRegistry(db);
		await schema.createCollection({
			slug: "posts",
			label: "Posts",
			labelSingular: "Post",
		});
		await schema.createField("posts", {
			slug: "title",
			label: "Title",
			type: "string",
		});
	});

	afterEach(async () => {
		await db.destroy();
	});

	test("keeps recent posts and pagination intact while avoiding a sort", async () => {
		const content = new ContentRepository(db);
		for (let i = 0; i < 40; i++) {
			await content.create({
				type: "posts",
				slug: `post-${i}`,
				status: i % 5 === 0 ? "draft" : "published",
				locale: "en",
				publishedAt: new Date(
					Date.UTC(2026, 0, 1) + Math.floor(i / 4) * 86_400_000,
				).toISOString(),
				data: { title: `Post ${39 - i}` },
			});
		}

		const before = await readPosts();
		await applyIndexes();
		const after = await readPosts();
		expect(after.result).toEqual(before.result);
		expect(after.result.entries).toHaveLength(25);
		expect(after.nextCursor).toBeDefined();
		const plan = await explain(after.query);
		expect(plan).toContain("USING INDEX idx_ep_posts_recent");
		expect(plan).not.toContain("TEMP B-TREE");

		const secondPage = await readPosts(25);
		expect(secondPage.result.entries).toHaveLength(7);
		expect(secondPage.nextCursor).toBeUndefined();
		const firstIds = new Set(after.result.entries.map((entry) => entry.id));
		expect(
			secondPage.result.entries.some((entry) => firstIds.has(entry.id)),
		).toBe(false);
		const feed = await readPosts(0, 10);
		expect(feed.result.entries).toEqual(after.result.entries.slice(0, 10));
	});

	test("seeks settings while preserving LIKE prefix matching and revisions", async () => {
		const options = new OptionsRepository(db);
		await options.set("site:title", "Example");
		await options.set("SITE:legacy", { enabled: true });
		await options.set("site:social", { github: "example" });
		for (let i = 0; i < 100; i++) await options.set(`unrelated:${i}`, i);
		const before = await options.getVersionedByPrefix("site:");
		await applyIndexes();
		queries = [];
		const after = await options.getVersionedByPrefix("site:");
		const query = queries[0]!;
		expect(after).toEqual(before);
		expect(after.size).toBe(3);
		expect(await explain(query)).toContain(
			"SEARCH options USING INDEX idx_ep_options_name_nocase",
		);

		await options.set("site:title", "Updated");
		expect(
			(await options.getVersionedByPrefix("site:")).get("site:title"),
		).not.toEqual(before.get("site:title"));
		await applyIndexes();
	});

	async function readPosts(offset = 0, limit = 25) {
		queries = [];
		const result = await runWithContext({ editMode: false, db }, () =>
			emdashLoader().loadCollection({
				collection: "emdash",
				filter: {
					type: "posts",
					status: "published",
					limit,
					offset,
					orderBy: { published_at: "desc", title: "asc" },
				},
			}),
		);
		if ("error" in result) throw result.error;
		const query = queries.find((query) => query.sql.includes("_emdash_terms"));
		if (!query) throw new Error("Missing recent-posts query");
		const nextCursor = "nextCursor" in result ? result.nextCursor : undefined;
		return { result, query, nextCursor };
	}

	async function applyIndexes() {
		const migration = readFileSync(
			"migrations/0001_public_read_indexes.sql",
			"utf8",
		);
		for (const statement of migration.split(";")) {
			if (statement.trim()) await db.executeQuery(CompiledQuery.raw(statement));
		}
	}

	async function explain(query: CompiledQuery) {
		const result = await db.executeQuery<{ detail: string }>(
			CompiledQuery.raw(`EXPLAIN QUERY PLAN ${query.sql}`, [
				...query.parameters,
			]),
		);
		return result.rows.map((row) => row.detail).join("\n");
	}
});
