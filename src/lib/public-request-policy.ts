import { isStatefulRequest } from "./request-state";
import {
	isValidSearchCursor,
	isValidSearchCursorHistory,
	isValidSearchQuery,
	MAX_SEARCH_CURSOR_HISTORY,
} from "./search-policy";

const PUBLIC_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_PATH_LENGTH = 2048;
const MAX_QUERY_STRING_LENGTH = 2048;
const MAX_PATH_SEGMENTS = 16;
const MAX_PATH_SEGMENT_LENGTH = 200;
const MAX_PREVIEW_TOKEN_LENGTH = 1024;
const PREVIEW_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;
const SEARCH_PAGE_PATTERN = /^\/page\/([1-9]\d*)\/?$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const PHP_PROBE_PATH = /(?:^|\/)[^/]*\.php\d*~?(?:\/|$)/i;
const SCANNER_PROBE_PATHS = new Set([
	"/.env",
	"/.git",
	"/_environment",
	"/_profiler/phpinfo",
	"/api/graphql",
	"/graphql",
	"/phpinfo",
	"/v1/graphql",
	"/webroot/index.php/_environment",
	"/wordpress",
	"/wp",
]);
const SCANNER_PROBE_PREFIXES = [
	"/.env.",
	"/.git/",
	"/_environment/",
	"/_profiler/",
	"/vendor/phpunit/",
	"/wordpress/",
	"/wp/",
];

export interface PublicRequestPolicyResult {
	request: Request;
	response?: Response;
}

function isFrameworkPath(pathname: string) {
	return (
		pathname === "/_image" ||
		pathname === "/_emdash" ||
		pathname.startsWith("/_emdash/")
	);
}

function policyResponse(
	request: Request,
	status: 400 | 404 | 405 | 414,
	message: string,
) {
	return new Response(request.method === "HEAD" ? null : `${message}\n`, {
		status,
		headers: {
			"Cache-Control": "public, max-age=300",
			"Content-Type": "text/plain; charset=utf-8",
			...(status === 405 ? { Allow: "GET, HEAD, OPTIONS" } : {}),
			"X-Robots-Tag": "noindex, nofollow",
		},
	});
}

function requestWithUrl(request: Request, url: URL) {
	return new Request(url.toString(), request);
}

function decodedPathIsValid(pathname: string) {
	const segments = pathname.split("/").filter(Boolean);
	if (segments.length > MAX_PATH_SEGMENTS) return false;

	return segments.every((segment) => {
		try {
			const decoded = decodeURIComponent(segment);
			return (
				Array.from(decoded).length <= MAX_PATH_SEGMENT_LENGTH &&
				!CONTROL_CHARACTERS.test(decoded)
			);
		} catch {
			return false;
		}
	});
}

function validPreviewToken(params: URLSearchParams) {
	const tokens = params.getAll("_preview");
	if (tokens.length === 0) return true;
	if (tokens.length !== 1) return false;

	const token = tokens[0];
	return (
		token.length <= MAX_PREVIEW_TOKEN_LENGTH &&
		PREVIEW_TOKEN_PATTERN.test(token)
	);
}

function isScannerProbePath(pathname: string) {
	const normalized =
		pathname.length > 1 ? pathname.toLowerCase().replace(/\/+$/, "") : pathname;
	return (
		SCANNER_PROBE_PATHS.has(normalized) ||
		SCANNER_PROBE_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ||
		PHP_PROBE_PATH.test(normalized)
	);
}

function sanitizeSearchRequest(
	request: Request,
	url: URL,
	pageNumber: number,
): PublicRequestPolicyResult {
	const queries = url.searchParams.getAll("s");
	const cursors = url.searchParams.getAll("cursor");
	const history = url.searchParams.getAll("before");
	const isFirstPage = pageNumber === 1;
	const query = queries[0]?.trim() ?? "";
	const cursor = cursors[0];

	if (
		queries.length !== 1 ||
		!isValidSearchQuery(query) ||
		cursors.length > 1 ||
		!isValidSearchCursor(cursor) ||
		history.some((value) => value !== "" && !isValidSearchCursor(value)) ||
		history.length > MAX_SEARCH_CURSOR_HISTORY
	) {
		return {
			request,
			response: policyResponse(request, 400, "Invalid search request."),
		};
	}

	if (
		(!isFirstPage &&
			(!cursor || !isValidSearchCursorHistory(pageNumber, history))) ||
		(isFirstPage && (cursor !== undefined || history.length > 0))
	) {
		return {
			request,
			response: policyResponse(request, 404, "Search page not found."),
		};
	}

	const sanitized = new URL(url);
	sanitized.search = "";
	sanitized.searchParams.set("s", query);
	if (cursor) sanitized.searchParams.set("cursor", cursor);
	for (const previousCursor of history) {
		sanitized.searchParams.append("before", previousCursor);
	}

	if (sanitized.search !== url.search) {
		return {
			request,
			response: Response.redirect(sanitized, 308),
		};
	}

	return { request };
}

export function applyPublicRequestPolicy(
	request: Request,
): PublicRequestPolicyResult {
	const url = new URL(request.url);
	if (isFrameworkPath(url.pathname)) return { request };

	if (!PUBLIC_METHODS.has(request.method)) {
		return {
			request,
			response: policyResponse(request, 405, "Method not allowed."),
		};
	}
	if (request.method === "OPTIONS") {
		return {
			request,
			response: new Response(null, {
				status: 204,
				headers: { Allow: "GET, HEAD, OPTIONS" },
			}),
		};
	}
	if (isScannerProbePath(url.pathname)) {
		return {
			request,
			response: policyResponse(request, 404, "Not found."),
		};
	}

	if (
		url.pathname.length > MAX_PATH_LENGTH ||
		url.search.length > MAX_QUERY_STRING_LENGTH + 1
	) {
		return {
			request,
			response: policyResponse(request, 414, "Request target too long."),
		};
	}
	if (
		!decodedPathIsValid(url.pathname) ||
		!validPreviewToken(url.searchParams)
	) {
		return {
			request,
			response: policyResponse(request, 400, "Invalid request target."),
		};
	}

	if (url.searchParams.has("_preview")) return { request };

	if (url.searchParams.has("_edit")) {
		if (isStatefulRequest(request)) return { request };

		const canonical = new URL(url);
		canonical.searchParams.delete("_edit");
		return {
			request,
			response: Response.redirect(canonical, 302),
		};
	}

	if (url.pathname === "/" && url.searchParams.has("s")) {
		const query = url.searchParams.get("s")?.trim() ?? "";
		if (!query) {
			const canonical = new URL(url);
			canonical.search = "";
			return {
				request,
				response: Response.redirect(canonical, 308),
			};
		}
		return sanitizeSearchRequest(request, url, 1);
	}

	const searchPage = url.pathname.match(SEARCH_PAGE_PATTERN);
	if (searchPage) {
		const pageNumber = Number(searchPage[1]);
		if (
			!Number.isSafeInteger(pageNumber) ||
			pageNumber < 2 ||
			pageNumber > MAX_SEARCH_CURSOR_HISTORY + 1
		) {
			return {
				request,
				response: policyResponse(request, 404, "Search page not found."),
			};
		}
		if (!url.searchParams.has("s")) {
			return {
				request,
				response: policyResponse(request, 404, "Search page not found."),
			};
		}
		return sanitizeSearchRequest(request, url, pageNumber);
	}

	if (!url.search) return { request };

	const canonical = new URL(url);
	canonical.search = "";
	return { request: requestWithUrl(request, canonical) };
}
