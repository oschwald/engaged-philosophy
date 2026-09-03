export const MAX_ARCHIVE_PAGE = 100;

export function parseArchivePage(value: string): number | null {
	if (!/^[1-9]\d*$/.test(value)) return null;

	const page = Number(value);
	return Number.isSafeInteger(page) && page <= MAX_ARCHIVE_PAGE ? page : null;
}
