export const SITE_SETTINGS_CACHE_TAG = "site-settings";
export const PRIMARY_MENU_CACHE_TAG = "menu:primary";

export function taxonomyCacheTag(taxonomy: string) {
	return `taxonomy:${taxonomy}`;
}
