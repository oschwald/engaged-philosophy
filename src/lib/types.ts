import type { ContentEntry as EmDashContentEntry } from "emdash";
import type { RichTextValue } from "./rich-text-types";

export type { RichTextValue } from "./rich-text-types";

export interface MediaField {
	src?: string;
	alt?: string;
}

export interface PageData {
	id?: string;
	title?: string;
	path?: string;
	content?: RichTextValue;
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
	content?: RichTextValue;
	featured_image?: MediaField;
	published_on?: string;
}

export interface ProjectData extends PostData {
	highlight?: boolean;
	menu_order?: number;
}

export type ContentEntry<T> = EmDashContentEntry<T>;
