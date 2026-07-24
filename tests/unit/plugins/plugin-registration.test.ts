import { describe, expect, test } from "vitest";

import auditLogPlugin from "@emdash-cms/plugin-audit-log";

import { emdashPlugins } from "../../../astro.config.mjs";

import { createPlugin as createLegacyContentPlugin } from "../../../src/plugins/legacy-content-blocks";

describe("EmDash plugin registration", () => {
	test("registers the remaining legacy portable text blocks", () => {
		const plugin = createLegacyContentPlugin();
		const blocks = plugin.admin?.portableTextBlocks ?? [];
		const getBlock = (type: string) => {
			const block = blocks.find((item) => item.type === type);
			expect(block, `Expected ${type} block to be registered`).toBeDefined();
			return block!;
		};
		const getField = (blockType: string, actionId: string) => {
			const block = getBlock(blockType);
			const field = block.fields.find((item) => item.action_id === actionId);
			expect(
				field,
				`Expected ${blockType}.${actionId} field to be registered`,
			).toBeDefined();
			return field!;
		};

		expect(blocks.map(({ type }) => type)).not.toContain("legacyImage");
		expect(getField("legacyVideo", "url")).toMatchObject({
			type: "text_input",
			label: "Video URL",
		});
		expect(getBlock("legacyEmbed").label).toBe("Legacy embed");
		expect(getBlock("legacyPageList").label).toBe("Legacy page list");
	});

	test("registers configured embed blocks", () => {
		const embeds = emdashPlugins.find((plugin) => plugin.id === "embeds");

		expect(embeds).toMatchObject({
			id: "embeds",
			entrypoint: "@emdash-cms/plugin-embeds",
			componentsEntry: "@emdash-cms/plugin-embeds/astro",
			options: { types: ["youtube", "vimeo"] },
		});
	});

	test("registers the standard audit log plugin directly", () => {
		const plugin = emdashPlugins.find(({ id }) => id === "audit-log");

		expect(plugin).toBe(auditLogPlugin);
		expect(plugin).toMatchObject({
			format: "standard",
			entrypoint: "@emdash-cms/plugin-audit-log/sandbox",
			capabilities: ["content:read"],
		});
	});
});
