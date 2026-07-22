import {
	PRIMARY_MENU_CACHE_TAG,
	SITE_SETTINGS_CACHE_TAG,
	taxonomyCacheTag,
} from "./cache-tags";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function decodePathSegment(value: string) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

export function cacheTagsForMutation(method: string, pathname: string) {
	if (!MUTATION_METHODS.has(method.toUpperCase())) return [];

	if (pathname === "/_emdash/api/settings") {
		return [SITE_SETTINGS_CACHE_TAG];
	}

	if (pathname === "/_emdash/api/menus") {
		return [PRIMARY_MENU_CACHE_TAG];
	}

	const menuMatch = pathname.match(/^\/_emdash\/api\/menus\/([^/]+)(?:\/|$)/);
	if (menuMatch && decodePathSegment(menuMatch[1] ?? "") === "primary") {
		return [PRIMARY_MENU_CACHE_TAG];
	}

	const taxonomyMatch = pathname.match(
		/^\/_emdash\/api\/taxonomies\/([^/]+)\/terms(?:\/|$)/,
	);
	if (taxonomyMatch) {
		return [taxonomyCacheTag(decodePathSegment(taxonomyMatch[1] ?? ""))];
	}

	const assignmentMatch = pathname.match(
		/^\/_emdash\/api\/content\/([^/]+)\/([^/]+)\/terms\/([^/]+)\/?$/,
	);
	if (assignmentMatch) {
		const [, collection = "", id = "", taxonomy = ""] =
			assignmentMatch.map(decodePathSegment);
		return [collection, id, taxonomyCacheTag(taxonomy)];
	}

	return [];
}
