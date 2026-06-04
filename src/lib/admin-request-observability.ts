export const OBSERVED_REQUEST_SLOW_MS = 10_000;

const OBSERVED_COOKIE_NAMES = [
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

const OBSERVED_COOKIE_SET = new Set(OBSERVED_COOKIE_NAMES);

export interface ObservedRequestInfo {
	requestId: string;
	method: string;
	path: string;
	queryKeys: string[];
	reasons: string[];
	cookieFlags: {
		astroSession: boolean;
		cloudflareAccess: boolean;
		editMode: boolean;
		d1Bookmark: boolean;
		preview: boolean;
	};
}

export function getCookieNames(cookieHeader: string | null): string[] {
	if (!cookieHeader) return [];
	return cookieHeader
		.split(";")
		.map((cookie) => cookie.trim().split("=", 1)[0])
		.filter(Boolean);
}

function getQueryKeys(url: URL): string[] {
	return [...new Set(url.searchParams.keys())].sort();
}

export function getObservedRequestInfo(
	request: Request,
	requestId: string = crypto.randomUUID(),
): ObservedRequestInfo | null {
	const url = new URL(request.url);
	const cookieNames = new Set(getCookieNames(request.headers.get("Cookie")));
	const observedCookies = [...cookieNames].filter((name) =>
		OBSERVED_COOKIE_SET.has(name),
	);
	const reasons = [
		...(url.pathname.startsWith("/_emdash") ? ["emdash-route"] : []),
		...observedCookies.map((name) => `cookie:${name}`),
	];

	if (reasons.length === 0) return null;

	return {
		requestId,
		method: request.method,
		path: url.pathname,
		queryKeys: getQueryKeys(url),
		reasons,
		cookieFlags: {
			astroSession: cookieNames.has("astro-session"),
			cloudflareAccess:
				cookieNames.has("CF_Authorization") ||
				cookieNames.has("CF_AppSession") ||
				cookieNames.has("CF_Session"),
			editMode: cookieNames.has("emdash-edit-mode"),
			d1Bookmark: cookieNames.has("__em_d1_bookmark"),
			preview:
				cookieNames.has("emdash_preview") ||
				cookieNames.has("emdash_preview_params"),
		},
	};
}
