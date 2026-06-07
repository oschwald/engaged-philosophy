import { createHookPipeline } from "emdash";
import { describe, expect, test } from "vitest";

import { createPlugin } from "../../../src/plugins/audit-log";

function createStorage() {
	const entries = new Map<string, Record<string, any>>();

	return {
		entries,
		context: {
			plugin: { id: "audit-log", version: "0.2.0" },
			storage: {
				entries: {
					async put(id: string, data: Record<string, any>) {
						entries.set(id, data);
					},
					async query(options: { limit?: number } = {}) {
						const limit = options.limit ?? 50;
						const items = [...entries.entries()]
							.map(([id, data]) => ({ id, data }))
							.sort((a, b) => b.data.timestamp.localeCompare(a.data.timestamp))
							.slice(0, limit);

						return {
							items,
							cursor: undefined,
							hasMore: false,
						};
					},
				},
			},
			content: {
				async get(collection: string, id: string) {
					expect(collection).toBe("pages");
					expect(id).toBe("about");
					return {
						id,
						type: collection,
						slug: "about",
						status: "published",
						data: { title: "About", body: "Before" },
					};
				},
			},
			log: {
				debug() {},
				info() {},
				warn() {},
				error() {},
			},
			kv: {},
			site: {
				name: "Engaged Philosophy",
				url: "https://example.test",
				locale: "en",
			},
			url(path: string) {
				return new URL(path, "https://example.test").toString();
			},
		},
	};
}

function hookHandler(entry: any) {
	expect(entry, "Expected audit log hook to exist").toBeTruthy();
	return typeof entry === "function" ? entry : entry.handler;
}

describe("audit log plugin", () => {
	test("runs as native hooks and renders the admin history route", async () => {
		const plugin = createPlugin();

		expect(plugin.capabilities).toEqual([
			"content:read",
			"content:write",
			"media:read",
		]);
		expect(() => createHookPipeline([plugin as any])).not.toThrow();
		expect(plugin.hooks["content:beforeSave"].dependencies).toEqual([]);
		expect(plugin.hooks["content:beforeSave"].pluginId).toBe("audit-log");

		const beforeSaveHook = hookHandler(plugin.hooks["content:beforeSave"]);
		const afterSaveHook = hookHandler(plugin.hooks["content:afterSave"]);
		const adminRoute = plugin.routes.admin;

		expect(typeof beforeSaveHook).toBe("function");
		expect(typeof afterSaveHook).toBe("function");
		expect(typeof adminRoute?.handler).toBe("function");

		const { entries, context } = createStorage();

		await beforeSaveHook(
			{
				collection: "pages",
				content: {
					id: "about",
					slug: "about",
					status: "published",
					data: { title: "About", body: "After" },
				},
				isNew: false,
			},
			context,
		);

		await afterSaveHook(
			{
				collection: "pages",
				content: {
					id: "about",
					slug: "about",
					status: "published",
					data: { title: "About", body: "After" },
				},
				isNew: false,
			},
			context,
		);

		expect(entries.size).toBe(1);

		const entry = [...entries.values()][0];
		expect(entry).toMatchObject({
			action: "update",
			collection: "pages",
			resourceId: "about",
			resourceType: "content",
			metadata: {
				slug: "about",
				status: "published",
			},
		});
		expect(entry.changes.before.data.body).toBe("Before");
		expect(entry.changes.after.body).toBe("After");

		const history = (await adminRoute!.handler({
			...context,
			input: { type: "page_load", page: "/history" },
			request: new Request(
				"https://example.test/_emdash/api/plugins/audit-log/admin",
				{
					method: "POST",
				},
			),
			requestMeta: {},
		} as any)) as { blocks: Array<{ type: string; rows: unknown[] }> };

		const table = history.blocks.find((block: { type: string }) => {
			return block.type === "table";
		});
		expect(
			table,
			"Expected audit history admin route to return a table",
		).toBeDefined();
		if (!table) throw new Error("Expected audit history table");
		expect(table.rows).toHaveLength(1);
		expect(table.rows[0]).toMatchObject({
			action: "update",
			resource: "about",
			collection: "pages",
		});
	});
});
