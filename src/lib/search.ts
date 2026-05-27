import {
	getPublishedPages,
	getPublishedPosts,
	getPublishedProjects,
} from "./seed";
import {
	getEntryContent,
	getEntryExcerpt,
	getExcerptText,
	rewriteWordPressUploadUrl,
	stripHtml,
} from "./site";
import type { ContentEntry, PageData, PostData, ProjectData } from "./types";

export interface SearchResult {
	id: string;
	kind: "page" | "post" | "project";
	title: string;
	path: string;
	excerpt: string;
	imageSrc?: string;
}

interface RankedResult {
	entry: SearchResult;
	score: number;
	date: string;
}

const PAGE_SIZE = 10;

function scoreText(haystack: string, term: string, weight: number) {
	if (!haystack || !term) return 0;
	if (haystack === term) return weight * 3;
	if (haystack.startsWith(term)) return weight * 2;
	if (!haystack.includes(term)) return 0;
	return weight;
}

function countTermMatches(haystack: string, terms: string[], weight: number) {
	return terms.reduce(
		(total, term) => total + (haystack.includes(term) ? weight : 0),
		0,
	);
}

function rankEntry(
	kind: SearchResult["kind"],
	entry:
		| ContentEntry<PageData>
		| ContentEntry<PostData>
		| ContentEntry<ProjectData>,
	query: string,
	terms: string[],
	mediaUrlPrefix: string,
): RankedResult | null {
	const title = stripHtml(entry.data.title).trim();
	const path = entry.data.path?.trim() ?? "";
	if (!title || !path) return null;

	const content = getEntryContent(entry.data);
	const excerpt = getExcerptText(getEntryExcerpt(entry.data), content);
	const titleText = title.toLowerCase();
	const bodyText = stripHtml(content).toLowerCase();
	const pathText = path.toLowerCase();

	const score =
		scoreText(titleText, query, 50) +
		countTermMatches(titleText, terms, 20) +
		scoreText(pathText, query, 12) +
		countTermMatches(pathText, terms, 6) +
		scoreText(bodyText, query, 10) +
		countTermMatches(bodyText, terms, 4);

	if (score === 0) return null;

	return {
		entry: {
			id: entry.id,
			kind,
			title,
			path,
			excerpt,
			imageSrc: rewriteWordPressUploadUrl(
				entry.data.featured_image?.src,
				mediaUrlPrefix,
			),
		},
		score,
		date: "published_on" in entry.data ? (entry.data.published_on ?? "") : "",
	};
}

export function searchSite(
	rawQuery: string,
	page = 1,
	mediaUrlPrefix?: string,
) {
	const query = rawQuery.trim().toLowerCase();
	const terms = query.split(/\s+/).filter(Boolean);

	if (!query) {
		return {
			query: rawQuery.trim(),
			results: [] as SearchResult[],
			totalResults: 0,
			totalPages: 0,
			currentPage: 1,
		};
	}

	const ranked = [
		...getPublishedProjects().map((entry) =>
			rankEntry("project", entry, query, terms, mediaUrlPrefix ?? ""),
		),
		...getPublishedPages().map((entry) =>
			rankEntry("page", entry, query, terms, mediaUrlPrefix ?? ""),
		),
		...getPublishedPosts().map((entry) =>
			rankEntry("post", entry, query, terms, mediaUrlPrefix ?? ""),
		),
	]
		.filter((entry): entry is RankedResult => Boolean(entry))
		.sort(
			(left, right) =>
				right.score - left.score ||
				right.date.localeCompare(left.date) ||
				left.entry.title.localeCompare(right.entry.title),
		);

	const currentPage = Math.max(1, page);
	const totalResults = ranked.length;
	const totalPages = Math.ceil(totalResults / PAGE_SIZE);
	const startIndex = (currentPage - 1) * PAGE_SIZE;

	return {
		query: rawQuery.trim(),
		results: ranked
			.slice(startIndex, startIndex + PAGE_SIZE)
			.map((item) => item.entry),
		totalResults,
		totalPages,
		currentPage,
	};
}
