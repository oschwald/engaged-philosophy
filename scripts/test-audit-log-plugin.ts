import assert from "node:assert/strict";

import auditLogDefinition from "@emdash-cms/plugin-audit-log/sandbox";

function createStorage() {
	const entries = new Map();

	return {
		entries,
		context: {
			plugin: { id: "audit-log", version: "0.2.0" },
			storage: {
				entries: {
					async put(id, data) {
						entries.set(id, data);
					},
					async query(options = {}) {
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
				async get(collection, id) {
					assert.equal(collection, "pages");
					assert.equal(id, "about");
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
			site: {
				name: "Engaged Philosophy",
				url: "https://example.test",
				locale: "en",
			},
			url(path) {
				return new URL(path, "https://example.test").toString();
			},
		},
	};
}

const beforeSaveHook = auditLogDefinition.hooks["content:beforeSave"];
const afterSaveHook = auditLogDefinition.hooks["content:afterSave"];
const adminRoute = auditLogDefinition.routes.admin;

assert.equal(typeof beforeSaveHook?.handler, "function");
assert.equal(typeof afterSaveHook?.handler, "function");
assert.equal(typeof adminRoute?.handler, "function");

const { entries, context } = createStorage();

await beforeSaveHook.handler(
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

await afterSaveHook.handler(
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

assert.equal(entries.size, 1);

const entry = [...entries.values()][0];
assert.equal(entry.action, "update");
assert.equal(entry.collection, "pages");
assert.equal(entry.resourceId, "about");
assert.equal(entry.resourceType, "content");
assert.equal(entry.metadata.slug, "about");
assert.equal(entry.metadata.status, "published");
assert.equal(entry.changes.before.data.body, "Before");
assert.equal(entry.changes.after.body, "After");

const history = await adminRoute.handler(
	{
		input: { type: "page_load", page: "/history" },
		request: {
			url: "https://example.test/_emdash/api/plugins/audit-log/admin",
			method: "POST",
			headers: {},
		},
		requestMeta: {},
	},
	context,
);

const table = history.blocks.find((block) => block.type === "table");
assert.ok(table, "Expected audit history admin route to return a table block");
assert.equal(table.rows.length, 1);
assert.equal(table.rows[0].action, "update");
assert.equal(table.rows[0].resource, "about");
assert.equal(table.rows[0].collection, "pages");

console.log("Audit log plugin tests passed.");
