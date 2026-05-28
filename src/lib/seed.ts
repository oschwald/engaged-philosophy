import seedJson from "../../seed/seed.json";

import type {
	ContentEntry,
	MediaField,
	PageData,
	PostData,
	ProjectData,
} from "./types";

type TaxonomyMap = Record<string, string[]>;
type EmDashTermsMap = Record<string, Array<{ slug: string; label: string }>>;

interface RawMediaField {
	src?: string;
	alt?: string;
	$media?: {
		url?: string;
		alt?: string;
	};
}

interface RawEntry<T> {
	id: string;
	slug: string;
	status: string;
	data: T & { featured_image?: RawMediaField | null };
	taxonomies?: TaxonomyMap;
}

interface SeedMenuItem {
	label: string;
	url: string;
	target?: string;
	children?: SeedMenuItem[];
}

interface SeedTaxonomyTerm {
	slug: string;
	label: string;
}

interface SeedTaxonomy {
	name: string;
	terms?: SeedTaxonomyTerm[];
}

interface SeedMedia {
	url?: string;
	alt?: string;
	filename?: string;
	title?: string;
}

type SeedBackedEntry<T> = ContentEntry<T> & {
	slug: string;
	status: string;
	taxonomies: TaxonomyMap;
};

const seed = seedJson as {
	settings?: { title?: string; tagline?: string };
	menus?: Array<{ items?: SeedMenuItem[] }>;
	taxonomies?: SeedTaxonomy[];
	media?: Record<string, SeedMedia>;
	content?: {
		pages?: RawEntry<PageData>[];
		posts?: RawEntry<PostData>[];
		projects?: RawEntry<ProjectData>[];
	};
};

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
	entry: RawEntry<T>,
): SeedBackedEntry<
	Omit<T, "featured_image"> & { featured_image?: MediaField }
> {
	return {
		id: entry.id,
		slug: entry.slug,
		status: entry.status,
		taxonomies: entry.taxonomies ?? {},
		data: {
			...entry.data,
			featured_image: normalizeMediaField(entry.data.featured_image),
		},
	};
}

const pages = (seed.content?.pages ?? []).map((entry) => normalizeEntry(entry));
const posts = (seed.content?.posts ?? []).map((entry) => normalizeEntry(entry));
const projects = (seed.content?.projects ?? []).map((entry) =>
	normalizeEntry(entry),
);
const taxonomyMap = new Map(
	(seed.taxonomies ?? []).map((taxonomy) => [taxonomy.name, taxonomy]),
);
const excludedPaths = new Set([
	"1477",
	"project-guidelines-critical-thinking-3",
	"project/photos-for-our-furry-friends-2",
]);

function isPublished(entry: { status: string }) {
	return entry.status === "published";
}

function isPublicEntry(entry: { status: string; data: { path?: string } }) {
	return isPublished(entry) && !excludedPaths.has(entry.data.path ?? "");
}

function countAssignments(
	collection: SeedBackedEntry<ProjectData>[],
	taxonomy: string,
	slug: string,
) {
	return collection.filter((entry) =>
		entry.taxonomies[taxonomy]?.includes(slug),
	).length;
}

export function getSeedSettings() {
	return seed.settings ?? {};
}

export function getPrimaryMenu() {
	return seed.menus?.[0]?.items ?? [];
}

export function getMediaById(id: string) {
	return seed.media?.[id] ?? null;
}

export function getPublishedPages() {
	return pages.filter(isPublicEntry);
}

export function getPublishedPosts() {
	return posts.filter(isPublicEntry);
}

export function getPublishedProjects() {
	return projects.filter(isPublicEntry);
}

export function getPageBySlug(slug: string) {
	return (
		pages.find((entry) => entry.slug === slug && isPublicEntry(entry)) ?? null
	);
}

export function getPageByPath(path: string) {
	return (
		pages.find((entry) => entry.data.path === path && isPublicEntry(entry)) ??
		null
	);
}

export function getPostByPath(path: string) {
	return (
		posts.find((entry) => entry.data.path === path && isPublicEntry(entry)) ??
		null
	);
}

export function getPostBySlug(slug: string) {
	return (
		posts.find((entry) => entry.slug === slug && isPublicEntry(entry)) ?? null
	);
}

export function getPostsByCategory(slug: string) {
	return getPublishedPosts().filter((entry) =>
		entry.taxonomies.category?.includes(slug),
	);
}

export function getProjectBySlug(slug: string) {
	return (
		projects.find((entry) => entry.slug === slug && isPublicEntry(entry)) ??
		null
	);
}

export function getProjectsByTaxonomy(taxonomy: string, slug: string) {
	return getPublishedProjects().filter((entry) =>
		entry.taxonomies[taxonomy]?.includes(slug),
	);
}

export function getTaxonomyTerm(taxonomy: string, slug: string) {
	const term = taxonomyMap
		.get(taxonomy)
		?.terms?.find((item) => item.slug === slug);
	if (!term) return null;
	return {
		...term,
		count: countAssignments(getPublishedProjects(), taxonomy, slug),
	};
}

export function getTaxonomyTerms(taxonomy: string) {
	return (taxonomyMap.get(taxonomy)?.terms ?? []).map((term) => ({
		...term,
		count: countAssignments(getPublishedProjects(), taxonomy, term.slug),
	}));
}

export function getEntryTerms(
	entry: {
		taxonomies?: TaxonomyMap;
		data?: Record<string, unknown> & {
			terms?: EmDashTermsMap;
		};
	},
	taxonomy: string,
) {
	const hydratedTerms = entry.data?.terms?.[taxonomy];
	if (hydratedTerms) {
		return hydratedTerms;
	}

	const slugs = entry.taxonomies?.[taxonomy] ?? [];
	const terms = taxonomyMap.get(taxonomy)?.terms ?? [];
	return slugs
		.map((slug) => terms.find((term) => term.slug === slug))
		.filter((term): term is SeedTaxonomyTerm => Boolean(term));
}

export function getEntryTermSlugs(
	entry: {
		taxonomies?: TaxonomyMap;
		data?: Record<string, unknown> & {
			terms?: EmDashTermsMap;
		};
	},
	taxonomy: string,
) {
	const hydratedTerms = entry.data?.terms?.[taxonomy];
	if (hydratedTerms) {
		return hydratedTerms.map((term) => term.slug);
	}

	return entry.taxonomies?.[taxonomy] ?? [];
}

export function getTermsBySlugs(taxonomy: string, slugs: string[]) {
	const terms = taxonomyMap.get(taxonomy)?.terms ?? [];
	return slugs
		.map((slug) => terms.find((term) => term.slug === slug))
		.filter((term): term is SeedTaxonomyTerm => Boolean(term));
}
