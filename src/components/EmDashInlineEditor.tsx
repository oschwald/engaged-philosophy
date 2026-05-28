import type { PortableTextBlock } from "emdash/ui";

import { InlinePortableTextEditor } from "../../node_modules/emdash/src/components/InlinePortableTextEditor";

interface Props {
	value: PortableTextBlock[];
	collection: string;
	entryId: string;
	field: string;
}

export default function EmDashInlineEditor({
	value,
	collection,
	entryId,
	field,
}: Props) {
	const editorKey = `${collection}:${entryId}:${field}`;

	return (
		<InlinePortableTextEditor
			key={editorKey}
			value={value}
			collection={collection}
			entryId={entryId}
			field={field}
		/>
	);
}
