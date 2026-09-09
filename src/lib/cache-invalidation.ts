import { taxonomyCacheTag } from "./cache-tags";

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

	// EmDash 0.37 invalidates settings, menus, and taxonomy definitions/terms.
	// Its content-term assignment route still only clears the object cache.
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
