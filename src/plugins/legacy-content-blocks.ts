export function createPlugin() {
	return {
		// Keep the persisted ID stable even though image blocks are now native.
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
