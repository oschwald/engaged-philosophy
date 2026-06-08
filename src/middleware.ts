import { defineMiddleware } from "astro:middleware";

import {
	getPublishedPages,
	getPublishedPosts,
	getPublishedProjects,
} from "./lib/content";
import { renderSitemapXml, type SitemapInputEntry } from "./lib/sitemap";

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
		},
	};
}

async function renderSitemapResponse(origin: string) {
	const [pages, posts, projects] = await Promise.all([
		getPublishedPages(),
		getPublishedPosts(),
		getPublishedProjects(),
	]);
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
}

export const onRequest = defineMiddleware((context, next) => {
	if (context.url.pathname === "/sitemap.xml") {
		return renderSitemapResponse(context.url.origin);
	}

	return next();
});
