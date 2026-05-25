export interface MediaField {
	src?: string;
	alt?: string;
}

export interface PageData {
	id?: string;
	title?: string;
	path?: string;
	content_html?: string;
	featured_image?: MediaField;
	template?: string;
	about_html?: string;
	box_left_title?: string;
	box_left_html?: string;
	box_middle_title?: string;
	box_middle_html?: string;
	box_right_title?: string;
	box_right_html?: string;
}

export interface PostData {
	id?: string;
	title?: string;
	path?: string;
	excerpt_html?: string;
	content_html?: string;
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
