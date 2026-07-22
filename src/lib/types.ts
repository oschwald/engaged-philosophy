import type { ContentEntry as EmDashContentEntry, ContentSeo } from "emdash";
import type { RichTextValue } from "./rich-text-types";

export type { RichTextValue } from "./rich-text-types";

export interface MediaField {
	src?: string;
	alt?: string;
}

export interface PageData {
	id?: string;
	slug?: string | null;
	status?: string;
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
	author_name?: string;
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
	publishedAt?: Date | string | null;
	seo?: ContentSeo;
}

export interface PostData {
	id?: string;
	slug?: string | null;
	status?: string;
	title?: string;
	path?: string;
	excerpt?: RichTextValue;
	content?: RichTextValue;
	featured_image?: MediaField;
	published_on?: string;
	author_name?: string;
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
	publishedAt?: Date | string | null;
	seo?: ContentSeo;
}

export interface ProjectData extends PostData {
	highlight?: boolean;
	menu_order?: number;
}

export type ContentEntry<T> = EmDashContentEntry<T>;
