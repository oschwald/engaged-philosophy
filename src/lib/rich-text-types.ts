import type { PortableTextBlock } from "emdash/ui";

export interface RichTextAssetRef {
	_ref?: string;
	url?: string;
	provider?: string;
	meta?: Record<string, unknown>;
}

export interface RichTextRequiredAssetRef extends RichTextAssetRef {
	_ref: string;
}

export interface RichTextImageNode {
	_type: "image";
	_key: string;
	asset?: RichTextAssetRef;
	url?: string;
	alt?: string;
	caption?: string;
	href?: string;
	align?: "left" | "right" | "center";
	width?: number;
	height?: number;
	displayWidth?: number;
	displayHeight?: number;
	shape?: "rounded";
}

export interface RichTextLegacyImageNode extends Omit<
	RichTextImageNode,
	"_type"
> {
	_type: "legacyImage";
}

export type RichTextRenderableImageNode =
	| RichTextImageNode
	| RichTextLegacyImageNode;

export interface RichTextGalleryImageNode extends Omit<
	RichTextImageNode,
	"_type" | "asset"
> {
	_type: "image";
	asset: RichTextRequiredAssetRef;
}

export interface RichTextGalleryNode {
	_type: "gallery";
	_key: string;
	align?: "left" | "right" | "center";
	caption?: string;
	layout?: "figure" | "shortcode";
	images: RichTextGalleryImageNode[];
	columns?: number;
}

export interface RichTextVideoNode {
	_type: "legacyVideo";
	_key: string;
	url?: string;
	title?: string;
	mimeType?: string;
	width?: number;
	height?: number;
}

export interface RichTextEmbedNode {
	_type: "legacyEmbed";
	_key: string;
	provider?: string;
	url?: string;
	embedUrl?: string;
	title?: string;
}

export interface RichTextPageListNode {
	_type: "legacyPageList";
	_key: string;
}

export interface RichTextNumberedHeadingNode {
	_type: "numberedHeading";
	_key: string;
	level?: number;
	index: number;
	block: PortableTextBlock;
}

export type RichTextBlock =
	| PortableTextBlock
	| RichTextRenderableImageNode
	| RichTextGalleryNode
	| RichTextVideoNode
	| RichTextEmbedNode
	| RichTextPageListNode
	| RichTextNumberedHeadingNode;

export type RichTextValue = RichTextBlock[];
