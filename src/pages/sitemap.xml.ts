import type { APIRoute } from "astro";
import { getSeoMeta, getSiteSettings, type ContentSeo } from "emdash";

import {
	getPublishedPages,
	getPublishedPosts,
	getPublishedProjects,
} from "../lib/content";
import { projectPath } from "../lib/content-paths";
import { SITE_SETTINGS_CACHE_TAG } from "../lib/cache-tags";
import {
	PUBLIC_EDGE_CACHE_MAX_AGE_SECONDS,
	PUBLIC_EDGE_CACHE_SWR_SECONDS,
} from "../lib/site-config";
import {
	renderSitemapXml,
	sitemapOrigin,
	type SitemapInputEntry,
} from "../lib/sitemap";

interface SitemapSourceEntry {
	id: string;
	data: Omit<SitemapInputEntry["data"], "seo"> & {
		slug?: string | null;
		seo?: ContentSeo;
	};
}

function toSitemapEntry(
	entry: SitemapSourceEntry,
	siteUrl: string,
	path = entry.data.path,
): SitemapInputEntry {
	return {
		id: entry.id,
		image: getSeoMeta(entry, { siteUrl }).ogImage,
		data: {
			path,
			updatedAt: entry.data.updatedAt,
			publishedAt: entry.data.publishedAt,
			createdAt: entry.data.createdAt,
			seo: entry.data.seo,
		},
	};
}

export const prerender = false;

export const GET: APIRoute = async ({ cache, site, url }) => {
	cache.set({
		maxAge: PUBLIC_EDGE_CACHE_MAX_AGE_SECONDS,
		swr: PUBLIC_EDGE_CACHE_SWR_SECONDS,
		tags: [SITE_SETTINGS_CACHE_TAG, "pages", "posts", "projects"],
	});
	const [settings, pages, posts, projects] = await Promise.all([
		getSiteSettings(),
		getPublishedPages(),
		getPublishedPosts(),
		getPublishedProjects(),
	]);
	const origin = sitemapOrigin(settings?.url || site?.origin, url.origin);
	const body = renderSitemapXml(origin, [
		...pages.map((entry) => toSitemapEntry(entry, origin)),
		...posts.map((entry) => toSitemapEntry(entry, origin)),
		...projects.map((entry) =>
			toSitemapEntry(entry, origin, projectPath(entry.data.slug || entry.id)),
		),
	]);

	return new Response(body, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=0, must-revalidate",
		},
	});
};
