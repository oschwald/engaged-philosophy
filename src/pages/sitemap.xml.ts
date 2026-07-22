import type { APIRoute } from "astro";

import {
	getPublishedPages,
	getPublishedPosts,
	getPublishedProjects,
	getRuntimeSiteSettings,
} from "../lib/content";
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
	data: SitemapInputEntry["data"];
}

function toSitemapEntry(entry: SitemapSourceEntry): SitemapInputEntry {
	return {
		id: entry.id,
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

export const GET: APIRoute = async ({ url }) => {
	const [settings, pages, posts, projects] = await Promise.all([
		getRuntimeSiteSettings(),
		getPublishedPages(),
		getPublishedPosts(),
		getPublishedProjects(),
	]);
	const origin = sitemapOrigin(settings?.url, url.origin);
	const body = renderSitemapXml(origin, [
		...pages.map(toSitemapEntry),
		...posts.map(toSitemapEntry),
		...projects.map(toSitemapEntry),
	]);

	return new Response(body, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
