import type {
	ContentEntry as EmDashContentEntry,
	ContentSeo,
	InferCollectionData,
} from "emdash";

export type { RichTextValue } from "./rich-text-types";

export interface MediaField {
	src?: string;
	alt?: string;
}

export type SiteCollection = "pages" | "posts" | "projects";

export type RawCollectionData<C extends SiteCollection> =
	InferCollectionData<C>;

export type CollectionData<C extends SiteCollection> = Omit<
	RawCollectionData<C>,
	"featured_image" | "seo"
> & {
	featured_image?: MediaField;
	seo?: ContentSeo;
};

export type PageData = CollectionData<"pages">;
export type PostData = CollectionData<"posts">;
export type ProjectData = CollectionData<"projects">;

export type ContentEntry<T> = EmDashContentEntry<T>;
