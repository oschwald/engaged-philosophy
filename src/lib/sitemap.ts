const AMP_RE = /&/g;
const LT_RE = /</g;
const GT_RE = />/g;
const QUOT_RE = /"/g;
const APOS_RE = /'/g;

export interface SitemapInputEntry {
	id: string;
	image?: string | null;
	updated_at?: string | null;
	updatedAt?: string | Date | null;
	published_at?: string | null;
	publishedAt?: string | Date | null;
	createdAt?: string | Date | null;
	data: {
		path?: string | null;
		updated_at?: string | null;
		updatedAt?: string | Date | null;
		published_at?: string | null;
		publishedAt?: string | Date | null;
		published_on?: string | null;
		seo?: {
			canonical?: string | null;
			noIndex?: boolean;
		};
	};
}

export function canonicalSitemapOrigin(origin: string) {
	return origin.replace(/\/+$/, "");
}

export function sitemapPathToUrl(origin: string, path?: string | null) {
	const normalizedPath = (path ?? "").trim().replace(/^\/+|\/+$/g, "");
	const pathname = normalizedPath ? `/${normalizedPath}/` : "/";
	return `${canonicalSitemapOrigin(origin)}${pathname}`;
}

export function sitemapOrigin(
	configuredUrl: string | null | undefined,
	requestOrigin: string,
) {
	if (configuredUrl) {
		try {
			const url = new URL(configuredUrl);
			if (url.protocol === "http:" || url.protocol === "https:") {
				return url.origin;
			}
		} catch {
			// Fall back to the request origin when the saved setting is malformed.
		}
	}
	return new URL(requestOrigin).origin;
}

function sitemapEntryUrl(origin: string, entry: SitemapInputEntry) {
	const configuredCanonical = entry.data.seo?.canonical;
	if (!configuredCanonical) return sitemapPathToUrl(origin, entry.data.path);

	try {
		const canonical = new URL(
			configuredCanonical,
			`${canonicalSitemapOrigin(origin)}/`,
		);
		return canonical.origin === new URL(origin).origin ? canonical.href : null;
	} catch {
		return sitemapPathToUrl(origin, entry.data.path);
	}
}

function timestampValue(value?: string | Date | null) {
	if (!value) return "";
	return value instanceof Date ? value.toISOString() : value;
}

export function sitemapEntryLastmod(entry: SitemapInputEntry) {
	return (
		timestampValue(entry.updated_at) ||
		timestampValue(entry.updatedAt) ||
		timestampValue(entry.data.updated_at) ||
		timestampValue(entry.data.updatedAt) ||
		timestampValue(entry.published_at) ||
		timestampValue(entry.publishedAt) ||
		timestampValue(entry.data.published_at) ||
		timestampValue(entry.data.publishedAt) ||
		timestampValue(entry.data.published_on) ||
		timestampValue(entry.createdAt)
	);
}

function timestampMillis(value: string) {
	const millis = Date.parse(value);
	return Number.isNaN(millis) ? null : millis;
}

function newerLastmod(current: string, next: string) {
	if (!current) return next;
	if (!next) return current;

	const currentMillis = timestampMillis(current);
	const nextMillis = timestampMillis(next);
	if (currentMillis !== null && nextMillis !== null) {
		return nextMillis > currentMillis ? next : current;
	}
	if (currentMillis === null && nextMillis !== null) return next;
	if (currentMillis !== null && nextMillis === null) return current;
	return next > current ? next : current;
}

export function escapeSitemapXml(value: string) {
	return value
		.replace(AMP_RE, "&amp;")
		.replace(LT_RE, "&lt;")
		.replace(GT_RE, "&gt;")
		.replace(QUOT_RE, "&quot;")
		.replace(APOS_RE, "&apos;");
}

export function renderSitemapXml(origin: string, entries: SitemapInputEntry[]) {
	const urls = new Map<string, { lastmod: string; image: string | null }>();
	const lines = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
	];

	for (const entry of entries) {
		if (entry.data.seo?.noIndex) continue;
		const loc = sitemapEntryUrl(origin, entry);
		if (!loc) continue;
		const current = urls.get(loc);
		urls.set(loc, {
			lastmod: newerLastmod(current?.lastmod ?? "", sitemapEntryLastmod(entry)),
			image: entry.image || current?.image || null,
		});
	}

	for (const [loc, { lastmod, image }] of urls) {
		lines.push("  <url>");
		lines.push(`    <loc>${escapeSitemapXml(loc)}</loc>`);

		if (lastmod) {
			lines.push(`    <lastmod>${escapeSitemapXml(lastmod)}</lastmod>`);
		}
		if (image) {
			lines.push("    <image:image>");
			lines.push(`      <image:loc>${escapeSitemapXml(image)}</image:loc>`);
			lines.push("    </image:image>");
		}

		lines.push("  </url>");
	}

	lines.push("</urlset>");
	return lines.join("\n");
}
