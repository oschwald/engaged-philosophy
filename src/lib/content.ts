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

const COLLECTION_LIMIT = 1000;

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
	const { entries } = await getEmDashCollection(collection, {
		status: "published",
		limit: COLLECTION_LIMIT,
	});
	return entries
		.map((entry) =>
			normalizeEntry(entry as unknown as EmDashContentEntry<T>, collection),
		)
		.filter(isPublicEntry);
}

async function getPublishedCollectionByTerm<
	T extends { path?: string; featured_image?: RawMediaField | null },
>(collection: "posts" | "projects", taxonomy: string, slug: string) {
	const { entries } = await getEmDashCollection(collection, {
		status: "published",
		limit: COLLECTION_LIMIT,
		where: { [taxonomy]: slug },
	});
	return entries
		.map((entry) =>
			normalizeEntry(entry as unknown as EmDashContentEntry<T>, collection),
		)
		.filter(isPublicEntry);
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

	return (
		(await getPublishedPages()).find(
			(entry) => entry.data.path === normalizedPath,
		) ?? null
	);
}

export async function getPostByPath(path: string) {
	const normalizedPath = normalizeContentPath(path);
	const slug = slugFromPath(normalizedPath);
	const post = slug ? await getPostBySlug(slug) : null;
	if (post?.data.path === normalizedPath) return post;

	return (
		(await getPublishedPosts()).find(
			(entry) => entry.data.path === normalizedPath,
		) ?? null
	);
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

export function getPostsByCategory(slug: string) {
	return getPublishedCollectionByTerm<PostData>("posts", "category", slug);
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

export function getProjectsByTaxonomy(taxonomy: string, slug: string) {
	return getPublishedCollectionByTerm<ProjectData>("projects", taxonomy, slug);
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
	const wanted = new Set(slugs);
	return (await getTaxonomyTerms(taxonomy)).filter((term) =>
		wanted.has(term.slug),
	);
}
