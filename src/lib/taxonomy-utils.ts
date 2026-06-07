export const PROJECT_TAXONOMIES = [
	"topic",
	"schools",
	"professors",
	"courses",
	"semesters",
] as const;

export type ProjectTaxonomy = (typeof PROJECT_TAXONOMIES)[number];

export function isProjectTaxonomy(value: string): value is ProjectTaxonomy {
	return PROJECT_TAXONOMIES.includes(value as ProjectTaxonomy);
}
