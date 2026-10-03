import type { APIRoute } from "astro";
import { getSeoMeta, type ContentSeo } from "emdash";

import {
	getPublishedPages,
	getPublishedPosts,
	getPublishedProjects,
} from "../lib/content";
import { projectPath } from "../lib/content-paths";
import { SITE_SETTINGS_CACHE_TAG } from "../lib/cache-tags";
import {
	PUBLIC_SITE_URL,
	PUBLIC_EDGE_CACHE_MAX_AGE_SECONDS,
	PUBLIC_EDGE_CACHE_SWR_SECONDS,
} from "../lib/site-config";
import { renderSitemapXml, type SitemapInputEntry } from "../lib/sitemap";

interface SitemapSourceEntry {
	id: string;
	data: Omit<SitemapInputEntry["data"], "seo"> & {
		slug?: string | null;
		seo?: ContentSeo;
	};
}

function toSitemapEntry(
	entry: SitemapSourceEntry,
	path = entry.data.path,
): SitemapInputEntry {
	return {
		id: entry.id,
		image: getSeoMeta(entry, { siteUrl: PUBLIC_SITE_URL }).ogImage,
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

export const GET: APIRoute = async ({ cache }) => {
	cache.set({
		maxAge: PUBLIC_EDGE_CACHE_MAX_AGE_SECONDS,
		swr: PUBLIC_EDGE_CACHE_SWR_SECONDS,
		tags: [SITE_SETTINGS_CACHE_TAG, "pages", "posts", "projects"],
	});
	const [pages, posts, projects] = await Promise.all([
		getPublishedPages(),
		getPublishedPosts(),
		getPublishedProjects(),
	]);
	const body = renderSitemapXml([
		...pages.map((entry) => toSitemapEntry(entry)),
		...posts.map((entry) => toSitemapEntry(entry)),
		...projects.map((entry) =>
			toSitemapEntry(entry, projectPath(entry.data.slug || entry.id)),
		),
	]);

	return new Response(body, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=0, must-revalidate",
		},
	});
};
