import assert from "node:assert/strict";

import { createPlugin as createEmbedsPlugin } from "../src/plugins/embeds.ts";
import { createPlugin } from "../src/plugins/legacy-image-blocks.ts";

const plugin = createPlugin();
const blocks = plugin.admin?.portableTextBlocks ?? [];
const embedsPlugin = createEmbedsPlugin({ types: ["youtube", "vimeo"] });
const embedBlocks = embedsPlugin.admin?.portableTextBlocks ?? [];

function getBlock(type: string, sourceBlocks = blocks) {
	const block = sourceBlocks.find((item) => item.type === type);
	assert.ok(block, `Expected ${type} block to be registered`);
	return block;
}

function getField(blockType: string, actionId: string) {
	const block = getBlock(blockType);
	const field = block.fields.find((item) => item.action_id === actionId);
	assert.ok(field, `Expected ${blockType}.${actionId} field to be registered`);
	return field;
}

const legacyImageSource = getField("legacyImage", "id");
assert.equal(legacyImageSource.type, "media_picker");

const legacyVideoSource = getField("legacyVideo", "url");
assert.equal(legacyVideoSource.type, "text_input");
assert.equal(legacyVideoSource.label, "Video URL");

assert.equal(getBlock("youtube", embedBlocks).label, "YouTube Video");
assert.equal(getBlock("vimeo", embedBlocks).label, "Vimeo Video");

console.log("Plugin config tests passed.");
