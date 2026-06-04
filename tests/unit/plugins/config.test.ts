import { describe, expect, test } from "vitest";

import { createPlugin as createAuditLogPlugin } from "../../../src/plugins/audit-log";
import { createPlugin as createEmbedsPlugin } from "../../../src/plugins/embeds";
import { createPlugin as createLegacyImagePlugin } from "../../../src/plugins/legacy-image-blocks";

describe("plugin configuration", () => {
	test("registers legacy media portable text blocks", () => {
		const plugin = createLegacyImagePlugin();
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

		expect(getField("legacyImage", "id").type).toBe("media_picker");
		expect(getField("legacyVideo", "url")).toMatchObject({
			type: "text_input",
			label: "Video URL",
		});
		expect(getBlock("legacyEmbed").label).toBe("Legacy embed");
		expect(getBlock("legacyPageList").label).toBe("Legacy page list");
	});

	test("registers configured embed blocks", () => {
		const plugin = createEmbedsPlugin({ types: ["youtube", "vimeo"] });
		const blocks = plugin.admin?.portableTextBlocks ?? [];

		expect(blocks.find((item) => item.type === "youtube")?.label).toBe(
			"YouTube Video",
		);
		expect(blocks.find((item) => item.type === "vimeo")?.label).toBe(
			"Vimeo Video",
		);
	});

	test("registers audit log native hooks and admin UI", () => {
		const plugin = createAuditLogPlugin();

		expect(plugin.id).toBe("audit-log");
		expect(plugin.capabilities).toEqual([
			"content:read",
			"content:write",
			"media:read",
		]);
		expect(plugin.allowedHosts).toEqual([]);
		expect(plugin.storage.entries.indexes).toEqual([
			"timestamp",
			"action",
			"resourceType",
			"collection",
		]);
		expect(plugin.admin.pages?.[0]?.path).toBe("/history");
		expect(plugin.admin.widgets?.[0]?.id).toBe("recent-activity");
		expect(typeof plugin.routes.admin?.handler).toBe("function");
	});
});
