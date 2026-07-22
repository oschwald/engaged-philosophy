import { getSeoMeta, type PublicPageContext } from "emdash";
import { createPublicPageContext } from "emdash/page";

import type { ContentEntry, PageData, PostData, ProjectData } from "./types";

type SiteContentData = PageData | PostData | ProjectData;

export interface SiteContentContext {
	collection: "pages" | "posts" | "projects";
	entry: ContentEntry<SiteContentData>;
}

export function getSitePageCacheTags(
	content?: SiteContentContext,
	dependencies: string[] = [],
) {
	return [
		...new Set([...(content ? [content.entry.id] : []), ...dependencies]),
	];
}

interface CreateSitePageContextOptions {
	url: URL;
	siteTitle: string;
	siteDescription: string;
	siteUrl?: string | null;
	title?: string;
	description?: string;
	content?: SiteContentContext;
}

function toIsoDate(value?: Date | string | null) {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function getLegacyPublishedOn(data: SiteContentData) {
	return "published_on" in data ? data.published_on : undefined;
}

function absoluteCanonical(value: string | null, siteUrl: string) {
	if (!value) return null;
	try {
		const resolved = new URL(value, `${siteUrl}/`);
		return resolved.protocol === "http:" || resolved.protocol === "https:"
			? resolved.href
			: null;
	} catch {
		return null;
	}
}

export function createSitePageContext({
	url,
	siteTitle,
	siteDescription,
	siteUrl,
	title,
	description,
	content,
}: CreateSitePageContextOptions): PublicPageContext {
	const publicSiteUrl = (siteUrl || url.origin).replace(/\/$/, "");
	const isHome = url.pathname === "/" && !url.searchParams.has("s");
	const defaultPageTitle =
		title && title !== "Home" ? title : `${siteTitle} – ${siteDescription}`;
	const defaultDescription = description || siteDescription;
	const canonicalPath = url.pathname;
	const canonical = `${publicSiteUrl}${canonicalPath}`;

	if (!content) {
		const fullTitle = isHome
			? defaultPageTitle
			: title && title !== "Home"
				? `${title} – ${siteTitle}`
				: defaultPageTitle;
		return createPublicPageContext({
			url,
			kind: "custom",
			pageType: "website",
			title: fullTitle,
			pageTitle: title || siteTitle,
			description: defaultDescription,
			canonical,
			siteName: siteTitle,
			siteUrl: publicSiteUrl,
		});
	}

	const { collection, entry } = content;
	const data = entry.data;
	const article = collection === "posts" || collection === "projects";
	const meta = getSeoMeta(entry, {
		siteTitle: isHome ? undefined : siteTitle,
		siteUrl: publicSiteUrl,
		titleSeparator: " – ",
		path: canonicalPath,
		defaultTitle: defaultPageTitle,
		defaultDescription,
		defaultOgImage: data.featured_image?.src,
	});

	return createPublicPageContext({
		url,
		kind: "content",
		pageType: article ? "article" : "website",
		title: meta.title,
		pageTitle: meta.ogTitle,
		description: meta.description,
		canonical: absoluteCanonical(meta.canonical, publicSiteUrl) || canonical,
		image: meta.ogImage,
		seo: {
			ogTitle: meta.ogTitle,
			ogDescription: meta.ogDescription,
			ogImage: meta.ogImage,
			robots: meta.robots,
		},
		content: {
			collection,
			id: data.id || entry.id,
			slug: data.slug,
		},
		articleMeta: article
			? {
					publishedTime: toIsoDate(
						data.publishedAt || getLegacyPublishedOn(data),
					),
					modifiedTime: toIsoDate(data.updatedAt),
					author: data.author_name || null,
				}
			: undefined,
		siteName: siteTitle,
		siteUrl: publicSiteUrl,
	});
}
