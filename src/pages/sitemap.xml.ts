import type { APIRoute } from "astro";
import { getSeoMeta, type ContentSeo } from "emdash";

import {
	getPublishedPages,
	getPublishedPosts,
	getPublishedProjects,
	getRuntimeSiteSettings,
} from "../lib/content";
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
	updated_at?: string | null;
	updatedAt?: string | Date | null;
	published_at?: string | null;
	publishedAt?: string | Date | null;
	createdAt?: string | Date | null;
	data: Omit<SitemapInputEntry["data"], "seo"> & { seo?: ContentSeo };
}

function toSitemapEntry(
	entry: SitemapSourceEntry,
	siteUrl: string,
): SitemapInputEntry {
	return {
		id: entry.id,
		image: getSeoMeta(entry, { siteUrl }).ogImage,
		updated_at: entry.updated_at,
		updatedAt: entry.updatedAt,
		published_at: entry.published_at,
		publishedAt: entry.publishedAt,
		createdAt: entry.createdAt,
		data: {
			path: entry.data.path,
			updated_at: entry.data.updated_at,
			updatedAt: entry.data.updatedAt,
			published_at: entry.data.published_at,
			publishedAt: entry.data.publishedAt,
			published_on: entry.data.published_on,
			seo: entry.data.seo,
		},
	};
}

export const prerender = false;

export const GET: APIRoute = async ({ cache, url }) => {
	cache.set({
		maxAge: PUBLIC_EDGE_CACHE_MAX_AGE_SECONDS,
		swr: PUBLIC_EDGE_CACHE_SWR_SECONDS,
		tags: [SITE_SETTINGS_CACHE_TAG, "pages", "posts", "projects"],
	});
	const [settings, pages, posts, projects] = await Promise.all([
		getRuntimeSiteSettings(),
		getPublishedPages(),
		getPublishedPosts(),
		getPublishedProjects(),
	]);
	const origin = sitemapOrigin(settings?.url, url.origin);
	const body = renderSitemapXml(origin, [
		...pages.map((entry) => toSitemapEntry(entry, origin)),
		...posts.map((entry) => toSitemapEntry(entry, origin)),
		...projects.map((entry) => toSitemapEntry(entry, origin)),
	]);

	return new Response(body, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=0, must-revalidate",
		},
	});
};
