// Match EmDash's public cache hints and native admin-route invalidation.
export const SITE_SETTINGS_CACHE_TAG = "emdash:settings";
export const PRIMARY_MENU_CACHE_TAG = "emdash:menu:primary";

export function taxonomyCacheTag(taxonomy: string) {
	return `emdash:taxonomy:${taxonomy}`;
}
