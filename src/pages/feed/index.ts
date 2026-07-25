import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getSiteSettings } from "emdash";

import { SITE_SETTINGS_CACHE_TAG } from "../../lib/cache-tags";
import { getRecentPosts } from "../../lib/content";
import {
	getEntryContent,
	getEntryExcerpt,
	getExcerptText,
} from "../../lib/rich-text";
import {
	PUBLIC_EDGE_CACHE_MAX_AGE_SECONDS,
	PUBLIC_EDGE_CACHE_SWR_SECONDS,
	SITE_TAGLINE_FALLBACK,
	SITE_TITLE_FALLBACK,
} from "../../lib/site-config";
import { sitemapOrigin } from "../../lib/sitemap";

const RSS_POST_LIMIT = 10;

function entryDate(entry: {
	data: {
		publishedAt?: Date | null;
		createdAt?: Date | null;
		updatedAt?: Date | null;
	};
}) {
	return entry.data.publishedAt ?? entry.data.createdAt ?? entry.data.updatedAt;
}

export const prerender = false;

export const GET: APIRoute = async ({ cache, site, url }) => {
	cache.set({
		maxAge: PUBLIC_EDGE_CACHE_MAX_AGE_SECONDS,
		swr: PUBLIC_EDGE_CACHE_SWR_SECONDS,
		tags: [SITE_SETTINGS_CACHE_TAG, "posts"],
	});

	const [settings, { entries: posts }] = await Promise.all([
		getSiteSettings(),
		getRecentPosts(RSS_POST_LIMIT),
	]);
	const response = await rss({
		title: settings?.title || SITE_TITLE_FALLBACK,
		description: settings?.tagline || SITE_TAGLINE_FALLBACK,
		site: sitemapOrigin(settings?.url || site?.origin, url.origin),
		customData: "<language>en-US</language>",
		items: posts.map((post) => ({
			title: post.data.title,
			link: `/${post.data.path}/`,
			pubDate: entryDate(post) ?? undefined,
			description:
				getExcerptText(
					getEntryExcerpt(post.data),
					getEntryContent(post.data),
				) || undefined,
			categories: post.data.terms?.category?.map((term) => term.label),
		})),
	});

	response.headers.set("Content-Type", "application/rss+xml; charset=utf-8");
	response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
	return response;
};
