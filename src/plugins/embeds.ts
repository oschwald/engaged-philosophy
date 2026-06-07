type EmbedBlockType = "youtube" | "vimeo";

interface EmbedField {
	type: "text_input";
	action_id: string;
	label: string;
	placeholder?: string;
}

interface EmbedBlockMeta {
	label: string;
	icon: string;
	placeholder: string;
	fields: EmbedField[];
}

interface EmbedsPluginOptions {
	types?: EmbedBlockType[];
}

const DEFAULT_TYPES: EmbedBlockType[] = ["youtube", "vimeo"];

const EMBED_BLOCK_META: Record<EmbedBlockType, EmbedBlockMeta> = {
	youtube: {
		label: "YouTube Video",
		icon: "video",
		placeholder: "Paste YouTube URL...",
		fields: [
			{
				type: "text_input",
				action_id: "id",
				label: "YouTube URL",
				placeholder: "https://youtube.com/watch?v=...",
			},
			{ type: "text_input", action_id: "title", label: "Title" },
			{ type: "text_input", action_id: "poster", label: "Poster Image URL" },
			{
				type: "text_input",
				action_id: "params",
				label: "Player Parameters",
				placeholder: "start=57&end=75",
			},
		],
	},
	vimeo: {
		label: "Vimeo Video",
		icon: "video",
		placeholder: "Paste Vimeo URL...",
		fields: [
			{
				type: "text_input",
				action_id: "id",
				label: "Vimeo URL",
				placeholder: "https://vimeo.com/...",
			},
			{ type: "text_input", action_id: "poster", label: "Poster Image URL" },
			{ type: "text_input", action_id: "params", label: "Player Parameters" },
		],
	},
};

function enabledTypes(options: EmbedsPluginOptions) {
	return (options.types ?? DEFAULT_TYPES).filter(
		(type) => type in EMBED_BLOCK_META,
	);
}

export function createPlugin(options: EmbedsPluginOptions = {}) {
	return {
		id: "embeds",
		version: "0.0.1",
		capabilities: [],
		allowedHosts: [],
		storage: {},
		hooks: {},
		routes: {},
		admin: {
			portableTextBlocks: enabledTypes(options).map((type) => {
				const meta = EMBED_BLOCK_META[type];
				return {
					type,
					label: meta.label,
					icon: meta.icon,
					placeholder: meta.placeholder,
					fields: meta.fields,
				};
			}),
		},
	};
}
