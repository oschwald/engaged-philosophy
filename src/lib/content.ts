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
	edit?: unknown;
	data: T & {
		id?: string;
		status?: string;
		terms?: EmDashTermsMap;
	};
};
type RawMediaField = MediaField & {
	$media?: {
		url?: string;
		alt?: string;
	};
};

const COLLECTION_LIMIT = 1000;

function normalizeMediaField(
	media?: RawMediaField | null,
): MediaField | undefined {
	if (!media) return undefined;
	if (media.src) return { src: media.src, alt: media.alt };
	if (media.$media?.url)
		return { src: media.$media.url, alt: media.$media.alt };
	return undefined;
}

function normalizeEntry<T extends { featured_image?: RawMediaField | null }>(
	entry: EmDashContentEntry<T>,
): RuntimeEntry<Omit<T, "featured_image"> & { featured_image?: MediaField }> {
	return {
		...entry,
		data: {
			...entry.data,
			featured_image: normalizeMediaField(entry.data.featured_image),
		},
	};
}

function isPublicEntry(entry: { data: { path?: string } }) {
	return isPublicContentPath(entry.data.path);
}

function normalizeContentPath(path: string) {
	return path.replace(/^\/+|\/+$/g, "");
}

function slugFromPath(path: string) {
	return normalizeContentPath(path).split("/").filter(Boolean).at(-1) ?? "";
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
		.map((entry) => normalizeEntry(entry as unknown as EmDashContentEntry<T>))
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
		.map((entry) => normalizeEntry(entry as unknown as EmDashContentEntry<T>))
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
	const page = normalizeEntry(entry as unknown as EmDashContentEntry<PageData>);
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
	const post = normalizeEntry(entry as unknown as EmDashContentEntry<PostData>);
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
