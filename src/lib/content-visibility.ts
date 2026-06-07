export const CONTENT_VISIBILITY_EXCLUSIONS = [
	{
		path: "1477",
		reason: "Legacy WordPress utility page that should not be publicly routed.",
	},
	{
		path: "project-guidelines-critical-thinking-3",
		reason:
			"Duplicate imported page superseded by the canonical project guidelines page.",
	},
	{
		path: "project/photos-for-our-furry-friends-2",
		reason:
			"Duplicate imported project path superseded by the canonical project entry.",
	},
] as const;

const EXCLUDED_PUBLIC_PATHS: ReadonlySet<string> = new Set(
	CONTENT_VISIBILITY_EXCLUSIONS.map((entry) => entry.path),
);

function normalizeVisibilityPath(path?: string | null) {
	return (path ?? "").replace(/^\/+|\/+$/g, "");
}

export function isPublicContentPath(path?: string | null) {
	return !EXCLUDED_PUBLIC_PATHS.has(normalizeVisibilityPath(path));
}
