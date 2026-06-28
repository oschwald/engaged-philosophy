import { hasStatefulCookie } from "./anonymous-cloudflare-cache";

const PUBLIC_CONTENT_SECURITY_POLICY = [
	"default-src 'self'",
	"script-src 'self' https://www.youtube.com",
	"style-src 'self'",
	"img-src 'self' https: data: blob:",
	"font-src 'self' data:",
	"connect-src 'self'",
	"frame-src 'self' https://animoto.com https://player.vimeo.com https://www.youtube.com https://www.youtube-nocookie.com",
	"media-src 'self' https:",
	"manifest-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'self'",
].join("; ");

const AUTHENTICATED_PUBLIC_CONTENT_SECURITY_POLICY = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' https://www.youtube.com",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' https: data: blob:",
	"font-src 'self' data:",
	"connect-src 'self'",
	"frame-src 'self' https://animoto.com https://player.vimeo.com https://www.youtube.com https://www.youtube-nocookie.com",
	"media-src 'self' https:",
	"manifest-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'self'",
].join("; ");

const STRICT_TRANSPORT_SECURITY = "max-age=31536000; includeSubDomains";
const BASELINE_SECURITY_HEADERS = {
	"permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
	"referrer-policy": "strict-origin-when-cross-origin",
	"x-content-type-options": "nosniff",
};

function isAdminPath(pathname: string) {
	return pathname === "/_emdash" || pathname.startsWith("/_emdash/");
}

function isHttpsRequest(request: Request) {
	const url = new URL(request.url);
	if (url.protocol === "https:") return true;

	const forwardedProto = request.headers
		.get("x-forwarded-proto")
		?.split(",")[0]
		?.trim()
		.toLowerCase();
	return forwardedProto === "https";
}

function isHtmlResponse(response: Response) {
	return response.headers
		.get("content-type")
		?.toLowerCase()
		.includes("text/html");
}

function isStatefulRequest(request: Request) {
	return (
		hasStatefulCookie(request.headers.get("cookie")) ||
		request.headers.has("cf-access-jwt-assertion")
	);
}

export function applySecurityHeaders(request: Request, response: Response) {
	const securedResponse = new Response(response.body, response);

	for (const [name, value] of Object.entries(BASELINE_SECURITY_HEADERS)) {
		if (!securedResponse.headers.has(name)) {
			securedResponse.headers.set(name, value);
		}
	}

	if (
		isHttpsRequest(request) &&
		!securedResponse.headers.has("strict-transport-security")
	) {
		securedResponse.headers.set(
			"strict-transport-security",
			STRICT_TRANSPORT_SECURITY,
		);
	}

	const { pathname } = new URL(request.url);
	if (
		!isAdminPath(pathname) &&
		isHtmlResponse(securedResponse) &&
		!securedResponse.headers.has("content-security-policy")
	) {
		securedResponse.headers.set(
			"content-security-policy",
			isStatefulRequest(request)
				? AUTHENTICATED_PUBLIC_CONTENT_SECURITY_POLICY
				: PUBLIC_CONTENT_SECURITY_POLICY,
		);
	}

	return securedResponse;
}
