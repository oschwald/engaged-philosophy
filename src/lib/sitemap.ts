import { PUBLIC_SITE_URL } from "./site-config";

const AMP_RE = /&/g;
const LT_RE = /</g;
const GT_RE = />/g;
const QUOT_RE = /"/g;
const APOS_RE = /'/g;

export interface SitemapInputEntry {
	id: string;
	image?: string | null;
	data: {
		path?: string | null;
		updatedAt?: string | Date | null;
		publishedAt?: string | Date | null;
		createdAt?: string | Date | null;
		seo?: {
			canonical?: string | null;
			noIndex?: boolean;
		};
	};
}

export function sitemapPathToUrl(path?: string | null) {
	const normalizedPath = (path ?? "").trim().replace(/^\/+|\/+$/g, "");
	const pathname = normalizedPath ? `/${normalizedPath}/` : "/";
	return `${PUBLIC_SITE_URL}${pathname}`;
}

function sitemapEntryUrl(entry: SitemapInputEntry) {
	const configuredCanonical = entry.data.seo?.canonical;
	if (!configuredCanonical) return sitemapPathToUrl(entry.data.path);

	try {
		const canonical = new URL(configuredCanonical, `${PUBLIC_SITE_URL}/`);
		if (canonical.origin !== PUBLIC_SITE_URL) return null;
		return sitemapPathToUrl(canonical.pathname);
	} catch {
		return sitemapPathToUrl(entry.data.path);
	}
}

function timestampValue(value?: string | Date | null) {
	if (!value) return "";
	return value instanceof Date ? value.toISOString() : value;
}

export function sitemapEntryLastmod(entry: SitemapInputEntry) {
	return (
		timestampValue(entry.data.updatedAt) ||
		timestampValue(entry.data.publishedAt) ||
		timestampValue(entry.data.createdAt)
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

export function renderSitemapXml(entries: SitemapInputEntry[]) {
	const urls = new Map<string, { lastmod: string; image: string | null }>();
	const lines = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
	];

	for (const entry of entries) {
		if (entry.data.seo?.noIndex) continue;
		const loc = sitemapEntryUrl(entry);
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
