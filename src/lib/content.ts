import {
	cachedQuery,
	contentNamespaces,
	getEmDashCollection,
	getEmDashEntry,
	getRequestContext,
	getTaxonomyTerms as getEmDashTaxonomyTerms,
	getTerm,
	type ContentEntry as EmDashContentEntry,
} from "emdash";

import {
	derivePagePath,
	postPath,
	normalizeContentPath,
	slugFromPath,
} from "./content-paths";
import { getPublicMediaStorageUrl } from "./media";
import type {
	ContentEntry,
	MediaField,
	RawCollectionData,
	SiteCollection,
} from "./types";

type RuntimeEntry<T> = ContentEntry<T> & {
	data: T & {
		id?: string;
		status?: string;
	};
};
type NormalizedEntryData<T> = Omit<T, "featured_image"> & {
	featured_image?: MediaField;
	path?: string;
};
type RawMediaField = Omit<MediaField, "darkVariant"> & {
	provider?: string;
	meta?: {
		storageKey?: string;
	};
	darkVariant?: RawMediaField | null;
};

const COLLECTION_PAGE_SIZE = 1000;

function normalizeMediaField(
	media?: RawMediaField | null,
): MediaField | undefined {
	if (media?.provider !== "local" || !media.meta?.storageKey) return undefined;

	return {
		src: getPublicMediaStorageUrl(media.meta.storageKey),
		alt: media.alt,
		filename: media.filename,
		mimeType: media.mimeType,
		blurhash: media.blurhash,
		dominantColor: media.dominantColor,
		darkVariant: normalizeMediaField(media.darkVariant),
	};
}

function normalizeEntry<T extends { featured_image?: RawMediaField | null }>(
	entry: EmDashContentEntry<T>,
	collection?: string,
): RuntimeEntry<NormalizedEntryData<T>> {
	const data = {
		...entry.data,
		featured_image: normalizeMediaField(entry.data.featured_image),
	} as NormalizedEntryData<T> & {
		path?: string;
		slug?: string;
		publishedAt?: Date | null;
	};

	if (collection === "pages") {
		data.path = derivePagePath(data.path, data.slug || entry.id);
	} else if (collection === "posts") {
		data.path = postPath(data.slug || entry.id, data.publishedAt);
	}

	return {
		...entry,
		data,
	};
}

function flattenTerms<T extends { children?: T[] }>(terms: T[]): T[] {
	return terms.flatMap((term) => [term, ...flattenTerms(term.children ?? [])]);
}

async function getPublishedCollection<C extends SiteCollection>(collection: C) {
	const entries: Array<EmDashContentEntry<RawCollectionData<C>>> = [];
	let cursor: string | undefined;
	do {
		const result = await getEmDashCollection(collection, {
			status: "published",
			limit: COLLECTION_PAGE_SIZE,
			cursor,
		});
		entries.push(...result.entries);
		cursor = result.nextCursor;
	} while (cursor);

	return entries.map((entry) => normalizeEntry(entry, collection));
}

async function getPublishedCollectionPage<C extends "posts" | "projects">(
	collection: C,
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
		entries: result.entries.map((entry) => normalizeEntry(entry, collection)),
		hasMore: result.hasMore ?? false,
		cacheHint: result.cacheHint,
	};
}

export async function getPublishedEntriesByIds<C extends SiteCollection>(
	collection: C,
	ids: string[],
) {
	if (ids.length === 0) return [];

	const { entries } = await getEmDashCollection(collection, {
		status: "published",
		limit: ids.length,
		where: { id: ids },
	});
	return entries.map((entry) => normalizeEntry(entry, collection));
}

export function getRecentPosts(limit = 25) {
	return getPublishedCollectionPage("posts", {
		limit,
		orderBy: { published_at: "desc", title: "asc" },
	});
}

export function getHighlightedProjects(limit = 6) {
	return getPublishedCollectionPage("projects", {
		limit,
		where: { highlight: "1" },
		orderBy: { menu_order: "asc", published_at: "desc", title: "asc" },
	});
}

export function getPostsPageByCategory(slug: string, page: number, limit = 10) {
	return getPublishedCollectionPage("posts", {
		limit,
		offset: Math.max(0, page - 1) * limit,
		where: { category: slug },
		orderBy: { published_at: "desc", title: "asc" },
	});
}

export function getProjectsPageByTaxonomy(
	taxonomy: string,
	slug: string,
	page: number,
	limit = 10,
) {
	return getPublishedCollectionPage("projects", {
		limit,
		offset: Math.max(0, page - 1) * limit,
		where: { [taxonomy]: slug },
		orderBy: { menu_order: "asc", published_at: "desc", title: "asc" },
	});
}

export async function getPublishedPages() {
	return getPublishedCollection("pages");
}

export async function getPublishedPosts() {
	return getPublishedCollection("posts");
}

export async function getPublishedProjects() {
	return getPublishedCollection("projects");
}

export async function getPageBySlug(slug: string) {
	const { entry } = await getEmDashEntry("pages", slug);
	if (!entry) return null;
	return normalizeEntry(entry, "pages");
}

export async function getPageByPath(path: string) {
	const normalizedPath = normalizeContentPath(path);
	const context = getRequestContext();
	// Draft paths and locale fallbacks must resolve through EmDash's live lookup.
	if (
		!context?.editMode &&
		!context?.preview &&
		!context?.locale &&
		!context?.dbIsIsolated
	) {
		const paths = await cachedQuery({
			namespace: contentNamespaces("pages"),
			key: "ep:page-paths:v1",
			load: loadPublishedPagePaths,
		});
		const match =
			paths.find((page) => page.path === normalizedPath) ??
			paths.find((page) => page.storedPath === normalizedPath);
		if (!match) return null;

		const { entry } = await getEmDashEntry("pages", match.id);
		if (!entry) return null;
		const page = normalizeEntry(entry, "pages");
		// Keep stored-path aliases available to the route's canonical redirect.
		return page.data.path === normalizedPath ||
			entry.data.path === normalizedPath
			? page
			: null;
	}

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
	return normalizeEntry(entry, "pages");
}

async function loadPublishedPagePaths() {
	const paths: Array<{ path: string; id: string; storedPath?: string }> = [];
	let cursor: string | undefined;
	do {
		const result = await getEmDashCollection("pages", {
			status: "published",
			limit: COLLECTION_PAGE_SIZE,
			cursor,
		});
		// A partial index would turn valid pages into cached 404s.
		if (result.error) {
			throw new Error(
				`Unable to load published page paths: ${result.error.message}`,
			);
		}
		for (const entry of result.entries) {
			const path = derivePagePath(entry.data.path, entry.data.slug || entry.id);
			paths.push({
				path,
				id: entry.id,
				storedPath: entry.data.path !== path ? entry.data.path : undefined,
			});
		}
		cursor = result.nextCursor;
	} while (cursor);
	return paths;
}

export async function getPostByPath(path: string) {
	const normalizedPath = normalizeContentPath(path);
	let slug: string;
	try {
		slug = decodeURIComponent(slugFromPath(normalizedPath));
	} catch {
		return null;
	}
	const post = slug ? await getPostBySlug(slug) : null;
	return post?.data.path === normalizedPath ? post : null;
}

export async function getPostBySlug(slug: string) {
	const { entry } = await getEmDashEntry("posts", slug);
	if (!entry) return null;
	return normalizeEntry(entry, "posts");
}

export async function getProjectBySlug(slug: string) {
	const { entry } = await getEmDashEntry("projects", slug);
	if (!entry) return null;
	return normalizeEntry(entry, "projects");
}

export async function getTaxonomyTerms(taxonomy: string) {
	return flattenTerms(await getEmDashTaxonomyTerms(taxonomy));
}

/**
 * Resolve public archive metadata without asking EmDash to aggregate usage
 * counts for every term in the taxonomy. Archive templates only render the
 * selected term's label, so computing counts here is unnecessary D1 work.
 */
export function getTaxonomyTerm(taxonomy: string, slug: string) {
	return getTerm(taxonomy, slug, { includeCounts: false });
}
