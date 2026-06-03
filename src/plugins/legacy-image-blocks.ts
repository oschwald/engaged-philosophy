export function createPlugin() {
	return {
		id: "legacy-image-blocks",
		version: "0.1.0",
		capabilities: [],
		allowedHosts: [],
		storage: {},
		hooks: {},
		routes: {},
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
							action_id: "id",
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
							type: "select",
							action_id: "shape",
							label: "Shape",
							options: [
								{ label: "None", value: "none" },
								{ label: "Rounded", value: "rounded" },
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
				{
					type: "legacyVideo",
					label: "Legacy video",
					description: "Video block for WordPress playlist shortcode imports.",
					category: "Media",
					fields: [
						{
							type: "text_input",
							action_id: "url",
							label: "Video URL",
							placeholder: "https://...",
						},
						{
							type: "text_input",
							action_id: "title",
							label: "Title",
						},
						{
							type: "text_input",
							action_id: "mimeType",
							label: "MIME type",
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
				{
					type: "legacyEmbed",
					label: "Legacy embed",
					description: "Embed block for WordPress embed shortcode imports.",
					category: "Media",
					fields: [
						{
							type: "text_input",
							action_id: "url",
							label: "Source URL",
						},
						{
							type: "text_input",
							action_id: "embedUrl",
							label: "Embed URL",
						},
						{
							type: "text_input",
							action_id: "provider",
							label: "Provider",
						},
						{
							type: "text_input",
							action_id: "title",
							label: "Title",
						},
					],
				},
				{
					type: "legacyPageList",
					label: "Legacy page list",
					description:
						"Page list block for WordPress sitemap shortcode imports.",
					category: "Content",
					fields: [],
				},
			],
		},
	};
}
