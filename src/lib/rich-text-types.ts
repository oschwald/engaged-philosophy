import type { PortableTextBlock } from "emdash";

export interface RichTextAssetRef {
	_ref?: string;
	url?: string;
	provider?: string;
	meta?: Record<string, unknown>;
}

export interface RichTextRequiredAssetRef extends RichTextAssetRef {
	_ref: string;
}

interface RichTextGalleryImageFields {
	asset?: RichTextAssetRef;
	alt?: string;
	caption?: string;
	width?: number;
	height?: number;
}

export interface RichTextGalleryImageNode
	extends PortableTextBlock, RichTextGalleryImageFields {
	_type: "image";
	asset: RichTextRequiredAssetRef;
}

export interface RichTextGalleryNode extends PortableTextBlock {
	_type: "gallery";
	caption?: string;
	layout?: "figure" | "shortcode";
	images: RichTextGalleryImageNode[];
	columns?: number;
}

export interface RichTextVideoNode extends PortableTextBlock {
	_type: "legacyVideo";
	url?: string;
	title?: string;
	mimeType?: string;
	width?: number;
	height?: number;
}

export interface RichTextEmbedNode extends PortableTextBlock {
	_type: "legacyEmbed";
	provider?: string;
	url?: string;
	embedUrl?: string;
	title?: string;
}

export interface RichTextPageListNode extends PortableTextBlock {
	_type: "legacyPageList";
}

export type RichTextValue = PortableTextBlock[];
