export const MAX_SEARCH_QUERY_LENGTH = 128;
export const MAX_SEARCH_CURSOR_LENGTH = 1024;
export const MAX_SEARCH_CURSOR_HISTORY = 20;

export function isValidSearchCursorHistory(
	pageNumber: number,
	history: string[],
) {
	return (
		history.length <= MAX_SEARCH_CURSOR_HISTORY &&
		history.length === pageNumber - 1
	);
}

export function isValidSearchQuery(query: string) {
	const trimmed = query.trim();
	return (
		trimmed.length > 0 && Array.from(trimmed).length <= MAX_SEARCH_QUERY_LENGTH
	);
}

export function isValidSearchCursor(cursor: string | undefined) {
	return (
		cursor === undefined ||
		(cursor.length > 0 && cursor.length <= MAX_SEARCH_CURSOR_LENGTH)
	);
}
