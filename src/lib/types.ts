import type { PortableTextBlock } from "emdash/ui";

export interface MediaField {
	src?: string;
	alt?: string;
}

export type RichTextValue = string | PortableTextBlock[];

export interface PageData {
	id?: string;
	title?: string;
	path?: string;
	content?: RichTextValue;
	content_html?: RichTextValue;
	featured_image?: MediaField;
	template?: string;
	about_html?: RichTextValue;
	box_left_title?: string;
	box_left_html?: RichTextValue;
	box_middle_title?: string;
	box_middle_html?: RichTextValue;
	box_right_title?: string;
	box_right_html?: RichTextValue;
}

export interface PostData {
	id?: string;
	title?: string;
	path?: string;
	excerpt?: RichTextValue;
	excerpt_html?: RichTextValue;
	content?: RichTextValue;
	content_html?: RichTextValue;
	featured_image?: MediaField;
	published_on?: string;
}

export interface ProjectData extends PostData {
	highlight?: boolean;
	menu_order?: number;
}

export interface ContentEntry<T> {
	id: string;
	data: T;
}
