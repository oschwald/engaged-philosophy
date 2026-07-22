import {
	getEmDashCollection,
	getEmDashEntry,
	getMenu,
	getSiteSettings as getEmDashSiteSettings,
	getTaxonomyTerms as getEmDashTaxonomyTerms,
	getTerm,
	type ContentEntry as EmDashContentEntry,
} from "emdash";

import { isPublicContentPath } from "./content-visibility";
import {
	derivePagePath,
	derivePostPath,
	deriveProjectPath,
	normalizeContentPath,
	slugFromPath,
} from "./content-paths";
import { getPublicMediaStorageUrl, rewriteInternalMediaFileUrl } from "./media";
import type {
	ContentEntry,
	MediaField,
	PageData,
	PostData,
	ProjectData,
} from "./types";

type TaxonomyMap = Record<string, string[]>;
type EmDashTermsMap = Record<string, Array<{ slug: string; label: string }>>;
type RuntimeEntry<T> = ContentEntry<T> & {
	data: T & {
		id?: string;
		status?: string;
		terms?: EmDashTermsMap;
	};
};
type RawMediaField = MediaField & {
	provider?: string;
	id?: string;
	meta?: {
		storageKey?: string;
	};
	$media?: {
		url?: string;
		alt?: string;
	};
};

const COLLECTION_PAGE_SIZE = 1000;

function normalizeLocalMediaField(
	media: RawMediaField,
): MediaField | undefined {
	if (media.provider !== "local" || !media.meta?.storageKey) return undefined;

	return {
		src: getPublicMediaStorageUrl(media.meta.storageKey),
		alt: media.alt,
	};
}

function normalizeSeedMediaFallback(
	media: RawMediaField,
): MediaField | undefined {
	// Compatibility for older generated seed data. Current imports emit local
	// EmDash media values before content reaches runtime.
	if (!media.$media?.url) return undefined;
	return {
		src: rewriteInternalMediaFileUrl(media.$media.url),
		alt: media.$media.alt,
	};
}

function normalizeMediaField(
	media?: RawMediaField | null,
): MediaField | undefined {
	if (!media) return undefined;
	const localMedia = normalizeLocalMediaField(media);
	if (localMedia) return localMedia;
	if (media.src)
		return { src: rewriteInternalMediaFileUrl(media.src), alt: media.alt };
	return normalizeSeedMediaFallback(media);
}

function normalizeEntry<T extends { featured_image?: RawMediaField | null }>(
	entry: EmDashContentEntry<T>,
	collection?: string,
): RuntimeEntry<Omit<T, "featured_image"> & { featured_image?: MediaField }> {
	const data = {
		...entry.data,
		featured_image: normalizeMediaField(entry.data.featured_image),
	} as Omit<T, "featured_image"> & {
		featured_image?: MediaField;
		path?: string;
		slug?: string;
		published_on?: string;
		publishedAt?: Date | string | null;
		createdAt?: Date | string | null;
	};

	if (collection === "pages") {
		data.path = derivePagePath(data.path, data.slug || entry.id);
	} else if (collection === "posts") {
		data.path = derivePostPath(
			data.path,
			data.slug || entry.id,
			data.published_on,
			data.publishedAt,
			data.createdAt,
		);
	} else if (collection === "projects") {
		data.path = deriveProjectPath(data.path, data.slug || entry.id);
	}

	return {
		...entry,
		data,
	};
}

function isPublicEntry(entry: { data: { path?: string } }) {
	return isPublicContentPath(entry.data.path);
}

function flattenTerms<T extends { children?: T[] }>(terms: T[]): T[] {
	return terms.flatMap((term) => [term, ...flattenTerms(term.children ?? [])]);
}

async function getPublishedCollection<
	T extends { path?: string; featured_image?: RawMediaField | null },
>(collection: "pages" | "posts" | "projects") {
	const entries: Array<EmDashContentEntry<T>> = [];
	let cursor: string | undefined;
	do {
		const result = await getEmDashCollection(collection, {
			status: "published",
			limit: COLLECTION_PAGE_SIZE,
			cursor,
		});
		entries.push(
			...result.entries.map(
				(entry) => entry as unknown as EmDashContentEntry<T>,
			),
		);
		cursor = result.nextCursor;
	} while (cursor);

	return entries
		.map((entry) => normalizeEntry(entry, collection))
		.filter(isPublicEntry);
}

async function getPublishedCollectionPage<
	T extends { path?: string; featured_image?: RawMediaField | null },
>(
	collection: "posts" | "projects",
	options: {
		limit: number;
		offset?: number;
		where?: Record<string, string | string[]>;
		orderBy: Record<string, "asc" | "desc">;
	},
) {
	const result = await getEmDashCollection(collection, {
		status: "published",
		...options,
	});
	return {
		entries: result.entries
			.map((entry) =>
				normalizeEntry(entry as unknown as EmDashContentEntry<T>, collection),
			)
			.filter(isPublicEntry),
		hasMore: result.hasMore ?? false,
		cacheHint: result.cacheHint,
	};
}

export async function getPublishedEntriesByIds<
	T extends { path?: string; featured_image?: RawMediaField | null },
>(collection: "pages" | "posts" | "projects", ids: string[]) {
	if (ids.length === 0) return [];

	const { entries } = await getEmDashCollection(collection, {
		status: "published",
		limit: ids.length,
		where: { id: ids },
	});
	return entries
		.map((entry) =>
			normalizeEntry(entry as unknown as EmDashContentEntry<T>, collection),
		)
		.filter(isPublicEntry);
}

export function getRecentPosts(limit = 25) {
	return getPublishedCollectionPage<PostData>("posts", {
		limit,
		orderBy: { published_on: "desc", title: "asc" },
	});
}

export function getHighlightedProjects(limit = 6) {
	return getPublishedCollectionPage<ProjectData>("projects", {
		limit,
		where: { highlight: "1" },
		orderBy: { menu_order: "asc", published_on: "desc", title: "asc" },
	});
}

export function getPostsPageByCategory(slug: string, page: number, limit = 10) {
	return getPublishedCollectionPage<PostData>("posts", {
		limit,
		offset: Math.max(0, page - 1) * limit,
		where: { category: slug },
		orderBy: { published_on: "desc", title: "asc" },
	});
}

export function getProjectsPageByTaxonomy(
	taxonomy: string,
	slug: string,
	page: number,
	limit = 10,
) {
	return getPublishedCollectionPage<ProjectData>("projects", {
		limit,
		offset: Math.max(0, page - 1) * limit,
		where: { [taxonomy]: slug },
		orderBy: { menu_order: "asc", published_on: "desc", title: "asc" },
	});
}

export async function getRuntimeSiteSettings() {
	return getEmDashSiteSettings();
}

export async function getPrimaryMenu() {
	return (await getMenu("primary"))?.items ?? [];
}

export async function getPublishedPages() {
	return getPublishedCollection<PageData>("pages");
}

export async function getPublishedPosts() {
	return getPublishedCollection<PostData>("posts");
}

export async function getPublishedProjects() {
	return getPublishedCollection<ProjectData>("projects");
}

export async function getPageBySlug(slug: string) {
	const { entry } = await getEmDashEntry("pages", slug);
	if (!entry) return null;
	const page = normalizeEntry(
		entry as unknown as EmDashContentEntry<PageData>,
		"pages",
	);
	return isPublicEntry(page) ? page : null;
}

export async function getPageByPath(path: string) {
	const normalizedPath = normalizeContentPath(path);
	const slug = slugFromPath(normalizedPath);
	const page = slug ? await getPageBySlug(slug) : null;
	if (page?.data.path === normalizedPath) return page;

	const { entries } = await getEmDashCollection("pages", {
		status: "published",
		limit: 1,
		where: { path: normalizedPath },
	});
	const entry = entries[0];
	if (!entry) return null;
	const matched = normalizeEntry(
		entry as unknown as EmDashContentEntry<PageData>,
		"pages",
	);
	return isPublicEntry(matched) ? matched : null;
}

export async function getPostByPath(path: string) {
	const normalizedPath = normalizeContentPath(path);
	const slug = slugFromPath(normalizedPath);
	const post = slug ? await getPostBySlug(slug) : null;
	if (post?.data.path === normalizedPath) return post;

	const { entries } = await getEmDashCollection("posts", {
		status: "published",
		limit: 1,
		where: { path: normalizedPath },
	});
	const entry = entries[0];
	if (!entry) return null;
	const matched = normalizeEntry(
		entry as unknown as EmDashContentEntry<PostData>,
		"posts",
	);
	return isPublicEntry(matched) ? matched : null;
}

export async function getPostBySlug(slug: string) {
	const { entry } = await getEmDashEntry("posts", slug);
	if (!entry) return null;
	const post = normalizeEntry(
		entry as unknown as EmDashContentEntry<PostData>,
		"posts",
	);
	return isPublicEntry(post) ? post : null;
}

export async function getProjectBySlug(slug: string) {
	const { entry } = await getEmDashEntry("projects", slug);
	if (!entry) return null;
	const project = normalizeEntry(
		entry as unknown as EmDashContentEntry<ProjectData>,
		"projects",
	);
	return isPublicEntry(project) ? project : null;
}

export function getTaxonomyTerm(taxonomy: string, slug: string) {
	return getTerm(taxonomy, slug);
}

export async function getTaxonomyTerms(taxonomy: string) {
	return flattenTerms(await getEmDashTaxonomyTerms(taxonomy));
}

export function getEntryTerms(
	entry: {
		data?: Record<string, unknown> & {
			terms?: EmDashTermsMap;
		};
		taxonomies?: TaxonomyMap;
	},
	taxonomy: string,
) {
	return entry.data?.terms?.[taxonomy] ?? [];
}

export function getEntryTermSlugs(
	entry: {
		data?: Record<string, unknown> & {
			terms?: EmDashTermsMap;
		};
		taxonomies?: TaxonomyMap;
	},
	taxonomy: string,
) {
	return getEntryTerms(entry, taxonomy).map((term) => term.slug);
}

export async function getTermsBySlugs(taxonomy: string, slugs: string[]) {
	const uniqueSlugs = [...new Set(slugs)];
	const terms = await Promise.all(
		uniqueSlugs.map((slug) => getTerm(taxonomy, slug)),
	);
	return terms.filter((term) => term !== null);
}
