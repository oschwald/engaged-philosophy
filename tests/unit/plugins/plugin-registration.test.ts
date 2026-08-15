import { describe, expect, test, vi } from "vitest";

import auditLogPlugin from "@emdash-cms/plugin-audit-log";
import auditLogDefinition from "@emdash-cms/plugin-audit-log/sandbox";
import { adaptSandboxEntry, HookPipeline } from "emdash";

import {
	configuredAuditLogPlugin,
	emdashPlugins,
} from "../../../astro.config.mjs";

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

	test("grants the capabilities required by the audit log hooks", () => {
		const plugin = configuredAuditLogPlugin;

		expect(emdashPlugins).toContain(plugin);
		expect(plugin).not.toBe(auditLogPlugin);
		expect(plugin).toMatchObject({
			format: "standard",
			entrypoint: "@emdash-cms/plugin-audit-log/sandbox",
			capabilities: ["content:read", "content:write", "media:read"],
		});

		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const resolved = adaptSandboxEntry(auditLogDefinition, plugin);
			const hooks = new HookPipeline([resolved]).getRegisteredHooks();

			expect(hooks).toEqual(
				expect.arrayContaining(["content:beforeSave", "media:afterUpload"]),
			);
			expect(warn).not.toHaveBeenCalledWith(
				expect.stringContaining('Plugin "audit-log" declares'),
			);
		} finally {
			warn.mockRestore();
		}
	});
});
