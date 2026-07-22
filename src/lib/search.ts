import { search as searchEmDash } from "emdash";

import { getPublishedEntriesByIds } from "./content";
import { rewriteWordPressUploadUrl } from "./media";
import {
	getEntryContent,
	getEntryExcerpt,
	getExcerptText,
	stripHtml,
} from "./rich-text";
import type { PageData, PostData, ProjectData } from "./types";

export interface SearchResult {
	id: string;
	kind: "page" | "post" | "project";
	title: string;
	path: string;
	excerpt: string;
	imageSrc?: string;
}

export interface SiteSearchResponse {
	query: string;
	results: SearchResult[];
	nextCursor?: string;
}

const PAGE_SIZE = 10;
export const MAX_SEARCH_CURSOR_HISTORY = 20;
const SEARCH_COLLECTIONS = ["pages", "posts", "projects"] as const;
type SearchCollection = (typeof SEARCH_COLLECTIONS)[number];
type SearchEntryData = PageData | PostData | ProjectData;

function isSearchCollection(value: string): value is SearchCollection {
	return SEARCH_COLLECTIONS.some((collection) => collection === value);
}

function resultKind(collection: SearchCollection): SearchResult["kind"] {
	return collection === "pages"
		? "page"
		: collection === "posts"
			? "post"
			: "project";
}

export function searchCursorHistoryForNextPage(
	history: string[],
	cursor?: string,
) {
	if (history.length >= MAX_SEARCH_CURSOR_HISTORY) return null;
	return [...history, cursor ?? ""];
}

export function isValidSearchCursorHistory(
	pageNumber: number,
	history: string[],
) {
	return (
		history.length <= MAX_SEARCH_CURSOR_HISTORY &&
		history.length === pageNumber - 1
	);
}

export async function searchSite(
	rawQuery: string,
	cursor?: string,
	mediaUrlPrefix = "",
): Promise<SiteSearchResponse> {
	const query = rawQuery.trim();
	if (!query) return { query, results: [] };

	const response = await searchEmDash(query, {
		collections: [...SEARCH_COLLECTIONS],
		status: "published",
		limit: PAGE_SIZE,
		cursor,
	});
	const hits = response.items.filter((item) =>
		isSearchCollection(item.collection),
	);

	const entryGroups = await Promise.all(
		SEARCH_COLLECTIONS.map(async (collection) => {
			const ids = hits
				.filter((item) => item.collection === collection)
				.map((item) => item.id);
			const entries = await getPublishedEntriesByIds<SearchEntryData>(
				collection,
				ids,
			);
			return entries.map(
				(entry) => [`${collection}:${entry.id}`, entry] as const,
			);
		}),
	);
	const entriesByHit = new Map(entryGroups.flat());

	const results = hits.flatMap((hit): SearchResult[] => {
		const collection = hit.collection as SearchCollection;
		const entry = entriesByHit.get(`${collection}:${hit.id}`);
		if (!entry) return [];

		const title = stripHtml(entry.data.title).trim();
		const path = entry.data.path?.trim() ?? "";
		if (!title || !path) return [];

		return [
			{
				id: entry.id,
				kind: resultKind(collection),
				title,
				path,
				excerpt: getExcerptText(
					getEntryExcerpt(entry.data),
					getEntryContent(entry.data),
				),
				imageSrc: rewriteWordPressUploadUrl(
					entry.data.featured_image?.src,
					mediaUrlPrefix,
				),
			},
		];
	});

	return {
		query,
		results,
		nextCursor: response.nextCursor,
	};
}
