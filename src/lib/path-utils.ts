export function joinPath(parts: string[]) {
	return parts.filter(Boolean).join("/");
}

export function withTrailingSlash(pathname: string) {
	return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

// File names at any depth, such as /sitemap.xml or a stray /static/js/app.js.
// EmDash also skips its 404 log for file paths, so these keep their form.
const FILE_NAME_PATTERN =
	/\/[^/]+\.(?:atom|avif|css|csv|docx?|eot|epub|gif|html?|ics|ico|jpe?g|js|json|m4a|map|mov|mp3|mp4|odt|ogg|otf|pdf|png|pptx?|rss|rtf|svg|ttf|txt|wav|webmanifest|webp|woff2?|xlsx?|xml|zip)$/i;
// Static and legacy upload directories that hold only files, and Cloudflare's
// own endpoints.
const FILE_DIRECTORIES = new Set([
	"cdn-cgi",
	"img",
	"wp-content",
	"wp-includes",
]);

// Pages use the slash form, matching internal links and the sitemap. Files,
// reserved prefixes such as /_astro/ and /.well-known/, and file directories
// keep their form. So does a path starting with `//`, which a site-relative
// redirect would send to another host.
export function canonicalPagePath(pathname: string) {
	if (pathname.endsWith("/") || FILE_NAME_PATTERN.test(pathname)) {
		return pathname;
	}
	const firstSegment = (pathname.split("/")[1] ?? "").toLowerCase();
	return !firstSegment ||
		firstSegment.startsWith("_") ||
		firstSegment.startsWith(".") ||
		FILE_DIRECTORIES.has(firstSegment)
		? pathname
		: `${pathname}/`;
}

// A link or redirect target whose last segment has a dot may be a file, so it
// keeps its form. A dotted page slug then takes one extra hop to its slash form.
export function canonicalTargetPath(pathname: string) {
	return pathname.slice(pathname.lastIndexOf("/") + 1).includes(".")
		? pathname
		: canonicalPagePath(pathname);
}

// A site-relative link in the slash form, so following it costs no redirect.
// EmDash builds content and taxonomy menu links without the slash. Links to
// other sites, and links whose last segment has a dot, are returned as given.
export function canonicalSiteHref(href: string) {
	if (
		!href.startsWith("/") ||
		href.startsWith("//") ||
		href.startsWith("/\\")
	) {
		return href;
	}
	const end = href.search(/[?#]/);
	if (end === -1) {
		return canonicalTargetPath(href);
	}
	return `${canonicalTargetPath(href.slice(0, end))}${href.slice(end)}`;
}

// Whether a menu link is the current page, in either slash form. A link with a
// query or fragment shows other content or a part of a page, so it never counts.
export function isCurrentMenuLink(href: string, currentPath?: string) {
	if (currentPath === undefined || !href || /[?#]/.test(href)) {
		return false;
	}
	return withTrailingSlash(href) === withTrailingSlash(currentPath);
}
