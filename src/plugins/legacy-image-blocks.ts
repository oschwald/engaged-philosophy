import { definePlugin } from "emdash";

export function createPlugin() {
	return definePlugin({
		id: "legacy-image-blocks",
		version: "0.1.0",
		admin: {
			portableTextBlocks: [
				{
					type: "legacyImage",
					label: "Legacy image",
					description:
						"Image block for floated or linked images that need WordPress-style layout.",
					category: "Media",
					fields: [
						{
							type: "media_picker",
							action_id: "url",
							label: "Image",
							placeholder: "Choose an image",
						},
						{
							type: "text_input",
							action_id: "alt",
							label: "Alt text",
						},
						{
							type: "text_input",
							action_id: "caption",
							label: "Caption",
							multiline: true,
						},
						{
							type: "text_input",
							action_id: "href",
							label: "Link URL",
							placeholder: "Optional",
						},
						{
							type: "select",
							action_id: "align",
							label: "Alignment",
							options: [
								{ label: "None", value: "none" },
								{ label: "Left", value: "left" },
								{ label: "Right", value: "right" },
								{ label: "Center", value: "center" },
							],
						},
						{
							type: "number_input",
							action_id: "width",
							label: "Width",
						},
						{
							type: "number_input",
							action_id: "height",
							label: "Height",
						},
					],
				},
			],
		},
	});
}
