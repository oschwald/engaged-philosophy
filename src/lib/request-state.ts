const STATEFUL_COOKIE_NAMES = [
	"astro-session",
	"CF_Authorization",
	"CF_AppSession",
	"CF_Session",
	"emdash-edit-mode",
	"emdash_preview",
	"emdash_preview_params",
	"emdash_wp_auth",
	"__em_d1_bookmark",
];

function getCookieNames(cookieHeader: string): string[] {
	if (!cookieHeader) return [];
	return cookieHeader
		.split(";")
		.map((cookie) => cookie.trim().split("=", 1)[0])
		.filter(Boolean);
}

export function hasStatefulCookie(cookieHeader: string | null): boolean {
	const names = getCookieNames(cookieHeader ?? "");
	return names.some((name) => STATEFUL_COOKIE_NAMES.includes(name));
}
