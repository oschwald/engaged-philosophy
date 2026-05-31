import { getRequestContext } from "emdash";

interface EmDashEditRef {
	collection: string;
	id: string;
	status: string;
	hasDraft: boolean;
	field?: string;
}

interface EmDashFieldAnnotation {
	"data-emdash-ref": string;
}

interface EmDashEditProxy {
	readonly [field: string]: Partial<EmDashFieldAnnotation>;
}

export function getEntryDatabaseId<T extends { id?: string }>(item: {
	id: string;
	data: T;
}) {
	return item.data.id || item.id;
}

function hasEmDashEditProxy<T extends { id?: string }>(
	entry: object,
): entry is {
	id: string;
	data: T;
	edit: EmDashEditProxy & Partial<EmDashFieldAnnotation>;
} {
	return (
		"edit" in entry && typeof entry.edit === "object" && entry.edit !== null
	);
}

export function isEmDashEditMode() {
	return getRequestContext()?.editMode ?? false;
}

export function getEmDashEditAttrs(
	collection: string,
	identifier: string,
	status: string,
	field?: string,
) {
	const ref: EmDashEditRef = {
		collection,
		id: identifier,
		status,
		hasDraft: false,
		...(field ? { field } : {}),
	};

	return {
		"data-emdash-ref": JSON.stringify(ref),
	};
}

export function getEmDashEditEntryAttrs<T extends { id?: string }>(
	collection: string,
	entry: { id: string; data: T; status?: string },
	field?: string,
) {
	if (hasEmDashEditProxy<T>(entry)) {
		return field ? (entry.edit[field] ?? {}) : entry.edit;
	}

	return getEmDashEditAttrs(
		collection,
		getEntryDatabaseId(entry),
		entry.status ?? "published",
		field,
	);
}
