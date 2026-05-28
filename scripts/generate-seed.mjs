import fs from "node:fs";
import path from "node:path";

import { htmlToPortableText } from "./lib/portable-text.mjs";

const ROOT = process.cwd();
const WXR_PATH = path.join(ROOT, "engagedphilosophy.WordPress.2026-05-25.xml");
const SEED_DIR = path.join(ROOT, "seed");
const SEED_PATH = path.join(SEED_DIR, "seed.json");

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const ITEM_RE = /<item>([\s\S]*?)<\/item>/g;
const TERM_RE =
	/<wp:term>\s*<wp:term_id>(.*?)<\/wp:term_id>\s*<wp:term_taxonomy>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/wp:term_taxonomy>\s*<wp:term_slug><!\[CDATA\[(.*?)\]\]><\/wp:term_slug>\s*<wp:term_parent><!\[CDATA\[(.*?)\]\]><\/wp:term_parent>\s*<wp:term_name><!\[CDATA\[(.*?)\]\]><\/wp:term_name>\s*<\/wp:term>/gs;
const WP_CATEGORY_RE =
	/<wp:category>\s*<wp:term_id>(.*?)<\/wp:term_id>\s*<wp:category_nicename><!\[CDATA\[(.*?)\]\]><\/wp:category_nicename>\s*<wp:category_parent><!\[CDATA\[(.*?)\]\]><\/wp:category_parent>\s*<wp:cat_name><!\[CDATA\[(.*?)\]\]><\/wp:cat_name>\s*<\/wp:category>/gs;
const AUTHOR_RE =
	/<wp:author>[\s\S]*?<wp:author_login><!\[CDATA\[(.*?)\]\]><\/wp:author_login>[\s\S]*?<wp:author_display_name><!\[CDATA\[(.*?)\]\]><\/wp:author_display_name>[\s\S]*?<\/wp:author>/gs;
const META_RE =
	/<wp:postmeta>\s*<wp:meta_key><!\[CDATA\[(.*?)\]\]><\/wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(.*?)\]\]><\/wp:meta_value>\s*<\/wp:postmeta>/gs;
const ITEM_CATEGORY_RE =
	/<category domain="([^"]+)" nicename="([^"]+)"><!\[CDATA\[(.*?)\]\]><\/category>/gs;
const INTERNAL_UPLOAD_URL_RE =
	/(https?:\/\/(?:www\.)?engagedphilosophy\.com\/wp-content\/uploads\/[^"'()\s<>]+|\/wp-content\/uploads\/[^"'()\s<>]+)/gi;

function readFile(filePath) {
	return fs.readFileSync(filePath, "utf8").replace(CONTROL_CHARS, "");
}

function extractTag(source, tag) {
	const cdataMatch = source.match(
		new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "s"),
	);
	if (cdataMatch) return cdataMatch[1].trim();

	const plainMatch = source.match(
		new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "s"),
	);
	return plainMatch ? plainMatch[1].trim() : "";
}

function decodeEntities(value) {
	const namedEntities = {
		amp: "&",
		apos: "'",
		quot: '"',
		nbsp: " ",
		hellip: "…",
		ndash: "–",
		mdash: "—",
		lsquo: "‘",
		rsquo: "’",
		ldquo: "“",
		rdquo: "”",
	};

	return (value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, token) => {
		const lowerToken = token.toLowerCase();
		if (lowerToken.startsWith("#x")) {
			const codePoint = Number.parseInt(lowerToken.slice(2), 16);
			return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
		}
		if (lowerToken.startsWith("#")) {
			const codePoint = Number.parseInt(lowerToken.slice(1), 10);
			return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
		}
		return namedEntities[lowerToken] ?? entity;
	});
}

function slugify(value, fallback) {
	const base = decodeEntities(value)
		.normalize("NFKD")
		.replace(/[^\w\s-]/g, "")
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return base || fallback;
}

function normalizeStatus(status) {
	return status === "draft" ? "draft" : "published";
}

function toIsoDate(value) {
	if (!value) return "";
	return `${value.replace(" ", "T")}Z`;
}

function pathFromUrl(url, siteUrl) {
	if (!url) return "";

	try {
		const parsed = new URL(decodeEntities(url), siteUrl);
		return parsed.pathname.replace(/^\/+|\/+$/g, "");
	} catch {
		return "";
	}
}

function ensureUnique(value, seen, fallbackPrefix, explicitSet) {
	let candidate = value;
	let i = 2;
	while (!candidate || seen.has(candidate) || (explicitSet && candidate !== value && explicitSet.has(candidate))) {
		candidate = value ? `${value}-${i}` : `${fallbackPrefix}-${i}`;
		i += 1;
	}
	seen.add(candidate);
	return candidate;
}

function toMediaRef(attachment) {
	if (!attachment?.url) return undefined;
	return {
		$media: {
			url: attachment.url,
			alt: attachment.alt || attachment.title || "",
			filename: attachment.filename,
		},
	};
}

function normalizeBool(value) {
	if (!value) return false;
	const normalized = value.toLowerCase();
	return (
		normalized.includes("highlight") ||
		normalized === "1" ||
		normalized === "true"
	);
}

function normalizeHtml(value) {
	return decodeEntities(value || "")
		.replace(CONTROL_CHARS, "")
		.trim();
}

function normalizeUploadFilename(value) {
	return (value || "")
		.replace(/-e\d+(?=\.[^.]+$)/i, "")
		.replace(/-\d+x\d+(?=\.[^.]+$)/i, "");
}

function registerUnique(map, key, value) {
	if (!key || !value) return;
	const existing = map.get(key);
	if (!existing) {
		map.set(key, value);
		return;
	}
	if (existing !== value) {
		map.set(key, null);
	}
}

function repairInternalUploadLinks(
	value,
	exactReplacements,
	filenameReplacements,
	siteUrl,
) {
	return (value || "").replace(INTERNAL_UPLOAD_URL_RE, (match) => {
		const trimmed = match.trim();
		const absoluteUrl = trimmed.startsWith("/wp-content/uploads/")
			? new URL(trimmed, siteUrl).toString()
			: trimmed;
		const directReplacement =
			exactReplacements.get(absoluteUrl) ?? exactReplacements.get(trimmed);
		if (directReplacement) return directReplacement;

		try {
			const { pathname } = new URL(absoluteUrl);
			const filename = pathname.split("/").pop() || "";
			const normalizedFilename = normalizeUploadFilename(filename);
			const filenameReplacement = filenameReplacements.get(normalizedFilename);
			return filenameReplacement || match;
		} catch {
			return match;
		}
	});
}

function repairMalformedInternalLinks(value, postsBySlug) {
	return (value || "").replace(
		/((?:https?:\/\/(?:www\.)?engagedphilosophy\.com)?\/(?:(?:…|\.\.\.|%E2%80%A6)\/){2,}\d{2}\/([a-z0-9-]+)\/?)/gi,
		(match, _path, slug) => {
			const canonicalPath = postsBySlug.get(slug.toLowerCase());
			return canonicalPath ? `/${canonicalPath}/` : match;
		},
	);
}

function buildMenuTree(itemsById, parentId = "0") {
	return Object.values(itemsById)
		.filter((item) => item.parentId === parentId)
		.sort((a, b) => a.menuOrder - b.menuOrder)
		.map((item) => {
			const result = {
				type: "custom",
				label: item.label,
				url: item.url,
			};
			const children = buildMenuTree(itemsById, item.id);
			if (children.length > 0) result.children = children;
			return result;
		});
}

const rawXml = readFile(WXR_PATH);
const siteTitle =
	rawXml.match(/<channel>\s*<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ||
	"Engaged Philosophy";
const siteDescription =
	rawXml
		.match(/<channel>[\s\S]*?<description>([\s\S]*?)<\/description>/)?.[1]
		?.trim() || "Civic Engagement in Philosophy Classes";
const siteUrl =
	extractTag(rawXml, "wp:base_site_url") || "https://www.engagedphilosophy.com";

const authors = new Map();
for (const match of rawXml.matchAll(AUTHOR_RE)) {
	const [, login, displayName] = match;
	authors.set(login, displayName || login);
}

const taxonomies = new Map();
taxonomies.set("category", {
	name: "category",
	label: "Categories",
	labelSingular: "Category",
	hierarchical: true,
	collections: ["posts"],
	terms: [],
});

for (const match of rawXml.matchAll(TERM_RE)) {
	const [, , taxonomyCdata, taxonomyPlain, slug, parent, label] = match;
	const taxonomyName = (taxonomyCdata || taxonomyPlain || "").trim();
	if (
		!["topic", "schools", "professors", "courses", "semesters"].includes(
			taxonomyName,
		)
	)
		continue;

	if (!taxonomies.has(taxonomyName)) {
		taxonomies.set(taxonomyName, {
			name: taxonomyName,
			label:
				taxonomyName === "topic"
					? "Topics"
					: taxonomyName[0].toUpperCase() + taxonomyName.slice(1),
			labelSingular:
				taxonomyName === "topic"
					? "Topic"
					: taxonomyName === "schools"
						? "School"
						: taxonomyName === "courses"
							? "Course"
							: taxonomyName === "professors"
								? "Professor"
								: "Semester",
			hierarchical: taxonomyName !== "topic",
			collections: ["projects"],
			terms: [],
		});
	}

	taxonomies.get(taxonomyName).terms.push({
		slug,
		label,
		...(parent ? { parent } : {}),
	});
}

for (const match of rawXml.matchAll(WP_CATEGORY_RE)) {
	const [, , slug, parent, label] = match;
	taxonomies.get("category").terms.push({
		slug,
		label,
		...(parent ? { parent } : {}),
	});
}

const items = [...rawXml.matchAll(ITEM_RE)].map((match) => match[1]);
items.sort((left, right) => {
	const leftType = extractTag(left, "wp:post_type");
	const rightType = extractTag(right, "wp:post_type");
	if (leftType === "nav_menu_item" || rightType === "nav_menu_item") return 0;

	const leftStatus = extractTag(left, "wp:status");
	const rightStatus = extractTag(right, "wp:status");
	const leftSlug = extractTag(left, "wp:post_name");
	const rightSlug = extractTag(right, "wp:post_name");
	const leftLink = decodeEntities(extractTag(left, "link"));
	const rightLink = decodeEntities(extractTag(right, "link"));
	const leftPath = pathFromUrl(leftLink, siteUrl);
	const rightPath = pathFromUrl(rightLink, siteUrl);
	const leftContentLength = extractTag(left, "content:encoded").length;
	const rightContentLength = extractTag(right, "content:encoded").length;

	return (
		Number(rightStatus === "publish") - Number(leftStatus === "publish") ||
		Number(Boolean(rightSlug)) - Number(Boolean(leftSlug)) ||
		Number(Boolean(rightPath)) - Number(Boolean(leftPath)) ||
		rightContentLength - leftContentLength
	);
});
const attachments = new Map();
const attachmentReplacements = new Map();
const attachmentReplacementsByFilename = new Map();

for (const item of items) {
	const postType = extractTag(item, "wp:post_type");
	if (postType !== "attachment") continue;

	const postId = extractTag(item, "wp:post_id");
	const attachmentUrl = extractTag(item, "wp:attachment_url");
	const guidUrl = decodeEntities(extractTag(item, "guid"));
	const meta = Object.fromEntries(
		[...item.matchAll(META_RE)].map((m) => [m[1], m[2]]),
	);
	const filename = attachmentUrl ? attachmentUrl.split("/").pop() : "";

	if (attachmentUrl) {
		registerUnique(attachmentReplacements, attachmentUrl, attachmentUrl);
		if (guidUrl) {
			registerUnique(attachmentReplacements, guidUrl, attachmentUrl);
		}
		registerUnique(
			attachmentReplacementsByFilename,
			normalizeUploadFilename(filename),
			attachmentUrl,
		);
	}

	attachments.set(postId, {
		url: attachmentUrl,
		alt: meta._wp_attachment_image_alt || "",
		filename,
		title: extractTag(item, "title"),
	});
}

const pages = [];
const posts = [];
const projects = [];
const pageMap = new Map();
const rawMenuItems = [];
const usedPaths = new Set();
const usedSlugs = {
	pages: new Set(),
	posts: new Set(),
	projects: new Set(),
};

const explicitSlugs = {
	pages: new Set(),
	posts: new Set(),
	projects: new Set(),
};
const explicitPaths = new Set();

for (const item of items) {
	const postType = extractTag(item, "wp:post_type");
	if (!["page", "post", "project"].includes(postType))
		continue;

	const status = extractTag(item, "wp:status");
	if (!["publish", "draft"].includes(status)) continue;

	const link = decodeEntities(extractTag(item, "link"));
	const rawPath = pathFromUrl(link, siteUrl);
	if (rawPath) {
		explicitPaths.add(rawPath.replace(/^\/+|\/+$/g, ""));
	}

	const rawSlug = extractTag(item, "wp:post_name");
	if (rawSlug) {
		const postId = extractTag(item, "wp:post_id");
		const title = decodeEntities(extractTag(item, "title") || "");
		const generatedSlug = slugify(rawSlug, `${postType}-${postId}`);
		if (generatedSlug) {
			const typeKey = `${postType}s`;
			explicitSlugs[typeKey === "projects" ? "projects" : typeKey === "posts" ? "posts" : "pages"].add(generatedSlug);
		}
	}
}

for (const item of items) {
	const postType = extractTag(item, "wp:post_type");
	if (!["page", "post", "project", "nav_menu_item"].includes(postType))
		continue;

	const postId = extractTag(item, "wp:post_id");
	const status = extractTag(item, "wp:status");
	const rawTitle = extractTag(item, "title") || "";
	const title = decodeEntities(rawTitle) || `${postType} ${postId}`;
	const link = decodeEntities(extractTag(item, "link"));
	const creator = extractTag(item, "dc:creator");
	const authorName = authors.get(creator) || creator || "";
	const rawSlug = extractTag(item, "wp:post_name");
	const menuOrder = Number(extractTag(item, "wp:menu_order") || "0");
	const metas = Object.fromEntries(
		[...item.matchAll(META_RE)].map((m) => [m[1], m[2]]),
	);
	const categories = [...item.matchAll(ITEM_CATEGORY_RE)].map((m) => ({
		domain: m[1],
		slug: m[2],
		label: m[3],
	}));

	if (postType === "nav_menu_item") {
		const menuTerms = categories.filter(
			(category) => category.domain === "nav_menu",
		);
		if (!menuTerms.some((term) => term.slug === "main-menu")) continue;
		rawMenuItems.push({
			id: postId,
			parentId: metas._menu_item_menu_item_parent || "0",
			menuOrder: Number(extractTag(item, "wp:menu_order") || "0"),
			type: metas._menu_item_type || "custom",
			object: metas._menu_item_object || "",
			objectId: metas._menu_item_object_id || "",
			title: rawTitle,
			url: decodeEntities(metas._menu_item_url || ""),
		});
		continue;
	}

	if (!["publish", "draft"].includes(status)) continue;

	const statusValue = normalizeStatus(status);
	const rawPath = pathFromUrl(link, siteUrl);
	const generatedSlug = slugify(rawSlug || title, `${postType}-${postId}`);
	const slug = ensureUnique(
		generatedSlug,
		usedSlugs[`${postType}s`] || usedSlugs.pages,
		`${postType}-${postId}`,
		explicitSlugs[`${postType}s`] || explicitSlugs.pages,
	);

	let contentPath = rawPath;
	if (!contentPath) {
		if (postType === "page") {
			contentPath = slug === "home" ? "" : slug;
		} else if (postType === "project") {
			contentPath = `project/${slug}`;
		} else if (postType === "post") {
			const date = extractTag(item, "wp:post_date").slice(0, 10).split("-");
			contentPath = `${date[0]}/${date[1]}/${date[2]}/${slug}`;
		}
	}

	contentPath = contentPath.replace(/^\/+|\/+$/g, "");
	if (postType !== "page" || contentPath !== "") {
		contentPath = ensureUnique(contentPath, usedPaths, `${postType}-${postId}`, explicitPaths);
	}

	const thumbnail = toMediaRef(attachments.get(metas._thumbnail_id));
	const baseData = {
		title,
		path: contentPath,
		content: normalizeHtml(extractTag(item, "content:encoded")),
		author_name: authorName,
		legacy_wp_id: Number(postId),
		...(thumbnail ? { featured_image: thumbnail } : {}),
	};

	if (postType === "page") {
		const entry = {
			id: `page-${postId}`,
			slug,
			status: statusValue,
			data: {
				...baseData,
				template: metas._wp_page_template || "default",
				about_html: normalizeHtml(metas.about || ""),
				box_left_title: metas["box-left-title"] || "",
				box_left_html: normalizeHtml(metas["box-left"] || ""),
				box_middle_title: metas["box-middle-title"] || "",
				box_middle_html: normalizeHtml(metas["box-middle"] || ""),
				box_right_title: metas["box-right-title"] || "",
				box_right_html: normalizeHtml(metas["box-right"] || ""),
			},
		};
		pages.push(entry);
		pageMap.set(postId, {
			title,
			url: contentPath ? `/${contentPath}/` : "/",
		});
		continue;
	}

	if (postType === "post") {
		const entry = {
			id: `post-${postId}`,
			slug,
			status: statusValue,
			data: {
				...baseData,
				excerpt: normalizeHtml(extractTag(item, "excerpt:encoded")),
				published_on: toIsoDate(
					extractTag(item, "wp:post_date_gmt") ||
						extractTag(item, "wp:post_date"),
				),
			},
			taxonomies: {
				category: categories
					.filter((category) => category.domain === "category")
					.map((category) => category.slug),
			},
		};
		posts.push(entry);
		continue;
	}

	if (postType === "project") {
		const taxonomyAssignments = {};
		for (const taxonomyName of [
			"topic",
			"schools",
			"professors",
			"courses",
			"semesters",
		]) {
			const assigned = categories
				.filter((category) => category.domain === taxonomyName)
				.map((category) => category.slug);
			if (assigned.length > 0) taxonomyAssignments[taxonomyName] = assigned;
		}

		projects.push({
			id: `project-${postId}`,
			slug,
			status: statusValue,
			data: {
				...baseData,
				excerpt: normalizeHtml(extractTag(item, "excerpt:encoded")),
				highlight: normalizeBool(metas.highlight || ""),
				menu_order: menuOrder,
				published_on: toIsoDate(
					extractTag(item, "wp:post_date_gmt") ||
						extractTag(item, "wp:post_date"),
				),
			},
			taxonomies: taxonomyAssignments,
		});
	}
}

const pageItemsById = {};
const postPathsBySlug = new Map(
	posts.map((entry) => [entry.slug.toLowerCase(), entry.data.path]),
);
const seedMedia = Object.fromEntries(
	Array.from(attachments.entries()).map(([id, attachment]) => [
		id,
		{
			url: attachment.url,
			alt: attachment.alt || "",
			filename: attachment.filename || "",
			title: attachment.title || "",
		},
	]),
);

for (const entry of pages) {
	entry.data.content = repairMalformedInternalLinks(
		entry.data.content,
		postPathsBySlug,
	);
	entry.data.content = repairInternalUploadLinks(
		entry.data.content,
		attachmentReplacements,
		attachmentReplacementsByFilename,
		siteUrl,
	);
	entry.data.about_html = repairMalformedInternalLinks(
		entry.data.about_html,
		postPathsBySlug,
	);
	entry.data.about_html = repairInternalUploadLinks(
		entry.data.about_html,
		attachmentReplacements,
		attachmentReplacementsByFilename,
		siteUrl,
	);
	entry.data.box_left_html = repairMalformedInternalLinks(
		entry.data.box_left_html,
		postPathsBySlug,
	);
	entry.data.box_left_html = repairInternalUploadLinks(
		entry.data.box_left_html,
		attachmentReplacements,
		attachmentReplacementsByFilename,
		siteUrl,
	);
	entry.data.box_middle_html = repairMalformedInternalLinks(
		entry.data.box_middle_html,
		postPathsBySlug,
	);
	entry.data.box_middle_html = repairInternalUploadLinks(
		entry.data.box_middle_html,
		attachmentReplacements,
		attachmentReplacementsByFilename,
		siteUrl,
	);
	entry.data.box_right_html = repairMalformedInternalLinks(
		entry.data.box_right_html,
		postPathsBySlug,
	);
	entry.data.box_right_html = repairInternalUploadLinks(
		entry.data.box_right_html,
		attachmentReplacements,
		attachmentReplacementsByFilename,
		siteUrl,
	);
	entry.data.content = htmlToPortableText(entry.data.content, seedMedia);
	entry.data.about_html = htmlToPortableText(entry.data.about_html, seedMedia);
	entry.data.box_left_html = htmlToPortableText(
		entry.data.box_left_html,
		seedMedia,
	);
	entry.data.box_middle_html = htmlToPortableText(
		entry.data.box_middle_html,
		seedMedia,
	);
	entry.data.box_right_html = htmlToPortableText(
		entry.data.box_right_html,
		seedMedia,
	);
}

for (const entry of posts) {
	entry.data.content = repairMalformedInternalLinks(
		entry.data.content,
		postPathsBySlug,
	);
	entry.data.content = repairInternalUploadLinks(
		entry.data.content,
		attachmentReplacements,
		attachmentReplacementsByFilename,
		siteUrl,
	);
	entry.data.excerpt = repairMalformedInternalLinks(
		entry.data.excerpt,
		postPathsBySlug,
	);
	entry.data.excerpt = repairInternalUploadLinks(
		entry.data.excerpt,
		attachmentReplacements,
		attachmentReplacementsByFilename,
		siteUrl,
	);
	entry.data.content = htmlToPortableText(entry.data.content, seedMedia);
	entry.data.excerpt = htmlToPortableText(entry.data.excerpt, seedMedia);
}

for (const entry of projects) {
	entry.data.content = repairMalformedInternalLinks(
		entry.data.content,
		postPathsBySlug,
	);
	entry.data.content = repairInternalUploadLinks(
		entry.data.content,
		attachmentReplacements,
		attachmentReplacementsByFilename,
		siteUrl,
	);
	entry.data.excerpt = repairMalformedInternalLinks(
		entry.data.excerpt,
		postPathsBySlug,
	);
	entry.data.excerpt = repairInternalUploadLinks(
		entry.data.excerpt,
		attachmentReplacements,
		attachmentReplacementsByFilename,
		siteUrl,
	);
	entry.data.content = htmlToPortableText(entry.data.content, seedMedia);
	entry.data.excerpt = htmlToPortableText(entry.data.excerpt, seedMedia);
}

for (const item of rawMenuItems) {
	let label = item.title;
	let url = item.url;

	if (
		item.type === "post_type" &&
		item.object === "page" &&
		pageMap.has(item.objectId)
	) {
		const page = pageMap.get(item.objectId);
		label = page.title;
		url = page.url;
	}

	if (!url) continue;
	if (url.startsWith(siteUrl)) {
		url = `/${pathFromUrl(url, siteUrl)}`.replace(/\/+$/, "/");
		if (url === "/") url = "/";
	}
	if (!url.startsWith("/")) url = `/${url.replace(/^\/+/, "")}`;
	if (url !== "/" && !url.endsWith("/")) url = `${url}/`;

	pageItemsById[item.id] = {
		id: item.id,
		parentId: item.parentId,
		menuOrder: item.menuOrder,
		label: label || "Untitled",
		url,
	};
}

const seed = {
	$schema: "https://emdashcms.com/seed.schema.json",
	version: "1",
	meta: {
		name: "Engaged Philosophy",
		description: "Migrated from the Engaged Philosophy WordPress export",
		author: "GitHub Copilot",
	},
	settings: {
		title: decodeEntities(siteTitle),
		tagline: decodeEntities(siteDescription),
	},
	collections: [
		{
			slug: "pages",
			label: "Pages",
			labelSingular: "Page",
			supports: ["drafts", "revisions", "search"],
			fields: [
				{ slug: "title", label: "Title", type: "string", required: true },
				{
					slug: "path",
					label: "Path",
					type: "string",
					required: true,
					unique: true,
				},
				{ slug: "content", label: "Content", type: "portableText" },
				{ slug: "featured_image", label: "Featured Image", type: "image" },
				{ slug: "template", label: "Template", type: "string" },
				{ slug: "about_html", label: "About", type: "portableText" },
				{ slug: "box_left_title", label: "Left Box Title", type: "string" },
				{ slug: "box_left_html", label: "Left Box", type: "portableText" },
				{ slug: "box_middle_title", label: "Middle Box Title", type: "string" },
				{ slug: "box_middle_html", label: "Middle Box", type: "portableText" },
				{ slug: "box_right_title", label: "Right Box Title", type: "string" },
				{ slug: "box_right_html", label: "Right Box", type: "portableText" },
				{ slug: "author_name", label: "Author Name", type: "string" },
				{ slug: "legacy_wp_id", label: "Legacy WordPress ID", type: "integer" },
			],
		},
		{
			slug: "posts",
			label: "Posts",
			labelSingular: "Post",
			supports: ["drafts", "revisions", "search"],
			fields: [
				{ slug: "title", label: "Title", type: "string", required: true },
				{
					slug: "path",
					label: "Path",
					type: "string",
					required: true,
					unique: true,
				},
				{ slug: "excerpt", label: "Excerpt", type: "portableText" },
				{ slug: "content", label: "Content", type: "portableText" },
				{ slug: "featured_image", label: "Featured Image", type: "image" },
				{ slug: "published_on", label: "Published On", type: "datetime" },
				{ slug: "author_name", label: "Author Name", type: "string" },
				{ slug: "legacy_wp_id", label: "Legacy WordPress ID", type: "integer" },
			],
		},
		{
			slug: "projects",
			label: "Projects",
			labelSingular: "Project",
			supports: ["drafts", "revisions", "search"],
			fields: [
				{ slug: "title", label: "Title", type: "string", required: true },
				{
					slug: "path",
					label: "Path",
					type: "string",
					required: true,
					unique: true,
				},
				{ slug: "excerpt", label: "Excerpt", type: "portableText" },
				{ slug: "content", label: "Content", type: "portableText" },
				{ slug: "featured_image", label: "Featured Image", type: "image" },
				{
					slug: "highlight",
					label: "Highlight",
					type: "boolean",
					defaultValue: false,
				},
				{
					slug: "menu_order",
					label: "Menu Order",
					type: "integer",
					defaultValue: 0,
				},
				{ slug: "published_on", label: "Published On", type: "datetime" },
				{ slug: "author_name", label: "Author Name", type: "string" },
				{ slug: "legacy_wp_id", label: "Legacy WordPress ID", type: "integer" },
			],
		},
	],
	taxonomies: Array.from(taxonomies.values()).map((taxonomy) => ({
		...taxonomy,
		terms: taxonomy.terms.sort((a, b) => a.label.localeCompare(b.label)),
	})),
	menus: [
		{
			name: "primary",
			label: "Primary Navigation",
			items: buildMenuTree(pageItemsById),
		},
	],
	media: seedMedia,
	content: {
		pages: pages.sort((a, b) => a.data.path.localeCompare(b.data.path)),
		posts: posts.sort((a, b) => a.data.path.localeCompare(b.data.path)),
		projects: projects.sort((a, b) => a.data.path.localeCompare(b.data.path)),
	},
};

fs.mkdirSync(SEED_DIR, { recursive: true });
fs.writeFileSync(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`);

console.log(`Wrote ${SEED_PATH}`);
console.log(`Pages: ${pages.length}`);
console.log(`Posts: ${posts.length}`);
console.log(`Projects: ${projects.length}`);
