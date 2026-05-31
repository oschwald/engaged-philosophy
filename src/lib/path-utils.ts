export function joinPath(parts: string[]) {
	return parts.filter(Boolean).join("/");
}

export function sortByPublishedOn<
	T extends { data: { published_on?: string; title?: string } },
>(items: T[]) {
	return [...items].sort((a, b) => {
		const orderA =
			"menu_order" in a.data && typeof a.data.menu_order === "number"
				? a.data.menu_order
				: 0;
		const orderB =
			"menu_order" in b.data && typeof b.data.menu_order === "number"
				? b.data.menu_order
				: 0;
		if (orderA !== orderB) return orderA - orderB;

		const dateA = a.data.published_on ? Date.parse(a.data.published_on) : 0;
		const dateB = b.data.published_on ? Date.parse(b.data.published_on) : 0;
		if (dateA !== dateB) return dateB - dateA;
		return (a.data.title ?? "").localeCompare(b.data.title ?? "");
	});
}

export function ensureTrailingSlash(value: string) {
	if (value === "/") return value;
	return value.endsWith("/") ? value : `${value}/`;
}

export function findEntryByPath<T extends { path?: string }>(
	items: Array<{ data: T }>,
	path: string,
) {
	return items.find((item) => item.data.path === path) ?? null;
}

export function formatPathDate(path?: string) {
	const parts = (path ?? "").split("/");
	if (parts.length < 3) return "";
	const [year, month, day] = parts;
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	if (Number.isNaN(date.valueOf())) return "";
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	});
}
