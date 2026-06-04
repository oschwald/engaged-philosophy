import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export type CollectionSlug = "pages" | "posts" | "projects";

export interface ContentItem {
	id: string;
	type: string;
	slug: string | null;
	status: string;
	data: Record<string, unknown>;
	createdAt: string;
	publishedAt: string | null;
}

const SINGULAR_LABEL: Record<CollectionSlug, string> = {
	pages: "Page",
	posts: "Post",
	projects: "Project",
};

function slugify(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

function trimSlashes(value: string) {
	return value.replace(/^\/+|\/+$/g, "");
}

function dateParts(value?: string | null) {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return [
		String(date.getUTCFullYear()).padStart(4, "0"),
		String(date.getUTCMonth() + 1).padStart(2, "0"),
		String(date.getUTCDate()).padStart(2, "0"),
	];
}

interface JsonResponseLike {
	status: () => number;
	text: () => Promise<string>;
}

async function expectJsonResponse(response: JsonResponseLike, label: string) {
	const text = await response.text();
	expect(
		response.status(),
		`Expected ${label} to return 2xx\n${text}`,
	).toBeGreaterThanOrEqual(200);
	expect(
		response.status(),
		`Expected ${label} to return 2xx\n${text}`,
	).toBeLessThan(300);
	return text ? JSON.parse(text) : null;
}

export function uniqueTitle(prefix: string, testId: string) {
	const suffix = slugify(testId).slice(-18) || Date.now().toString(36);
	return `${prefix} ${suffix}`;
}

export function portableTextParagraph(text: string) {
	return [
		{
			_type: "block",
			_key: "body",
			style: "normal",
			markDefs: [],
			children: [
				{
					_type: "span",
					_key: "body-span",
					text,
					marks: [],
				},
			],
		},
	];
}

export function publicPathForItem(
	collection: CollectionSlug,
	item: ContentItem,
) {
	const slug = item.slug ?? item.id;
	const storedPath =
		typeof item.data.path === "string" ? trimSlashes(item.data.path) : "";

	if (collection === "pages") {
		return `/${storedPath || slug}/`;
	}

	if (collection === "projects") {
		return `/${storedPath || `project/${slug}`}/`;
	}

	const publishedOn =
		typeof item.data.published_on === "string" ? item.data.published_on : null;
	const parts =
		dateParts(publishedOn) ??
		dateParts(item.publishedAt) ??
		dateParts(item.createdAt);
	return `/${storedPath || [...(parts ?? []), slug].join("/")}/`;
}

export function canonicalAliasForItem(
	collection: Exclude<CollectionSlug, "pages">,
	item: ContentItem,
) {
	const slug = item.slug ?? item.id;
	return `/${collection}/${slug}/`;
}

export async function dismissWelcome(page: Page) {
	const dialog = page.getByRole("dialog", { name: /Welcome to EmDash/ });
	try {
		await dialog.waitFor({ state: "visible", timeout: 2000 });
	} catch {
		return;
	}

	const primary = dialog.getByRole("button", { name: "Get Started" });
	const close = dialog.getByRole("button", { name: "Close" });
	if ((await primary.count()) > 0) {
		await primary.click();
	} else {
		await close.click();
	}
	await dialog.waitFor({ state: "hidden", timeout: 5000 });
}

export async function createContentViaApi(
	request: APIRequestContext,
	collection: CollectionSlug,
	options: {
		title: string;
		content?: string;
		slug?: string;
		data?: Record<string, unknown>;
		publishedAt?: string;
	},
) {
	const response = await request.post(`/_emdash/api/content/${collection}`, {
		data: {
			slug: options.slug,
			publishedAt: options.publishedAt,
			data: {
				title: options.title,
				content: portableTextParagraph(options.content ?? options.title),
				...(options.data ?? {}),
			},
		},
	});
	const body = await expectJsonResponse(response, `create ${collection}`);
	return body?.data?.item as ContentItem;
}

export async function publishContentViaApi(
	request: APIRequestContext,
	collection: CollectionSlug,
	id: string,
	options: { publishedAt?: string } = {},
) {
	const response = await request.post(
		`/_emdash/api/content/${collection}/${id}/publish`,
		{
			data: options.publishedAt ? { publishedAt: options.publishedAt } : {},
		},
	);
	const body = await expectJsonResponse(response, `publish ${collection}`);
	return body?.data?.item as ContentItem;
}

export async function createAndPublishContentViaApi(
	request: APIRequestContext,
	collection: CollectionSlug,
	options: Parameters<typeof createContentViaApi>[2],
) {
	const created = await createContentViaApi(request, collection, options);
	const published = await publishContentViaApi(
		request,
		collection,
		created.id,
		{
			publishedAt: options.publishedAt,
		},
	);
	return {
		created,
		published,
		publicPath: publicPathForItem(collection, published),
	};
}

export async function createAndPublishContentViaAdmin(
	page: Page,
	collection: CollectionSlug,
	options: { title: string; content: string; slug?: string },
) {
	await page.goto(`/_emdash/admin/content/${collection}/new`, {
		waitUntil: "domcontentloaded",
	});
	await dismissWelcome(page);

	await expect(
		page.getByRole("heading", { name: `New ${SINGULAR_LABEL[collection]}` }),
	).toBeVisible();
	await page.getByLabel("Title", { exact: true }).fill(options.title);
	if (options.slug) {
		await page.getByLabel("Slug", { exact: true }).fill(options.slug);
	}

	const contentEditorIndex = collection === "pages" ? 0 : 1;
	const contentEditor = page
		.locator('[contenteditable="true"]')
		.nth(contentEditorIndex);
	await expect(contentEditor).toBeVisible();
	await contentEditor.click();
	await page.keyboard.type(options.content);

	const saveResponsePromise = page.waitForResponse(
		(response) =>
			response.request().method() === "POST" &&
			response.url().includes(`/_emdash/api/content/${collection}`) &&
			!response.url().includes("/publish"),
	);
	await page.getByRole("button", { name: "Save", exact: true }).first().click();
	const createdBody = await expectJsonResponse(
		await saveResponsePromise,
		`save ${collection}`,
	);
	const created = createdBody?.data?.item as ContentItem;

	await expect(page).toHaveURL(
		new RegExp(`/_emdash/admin/content/${collection}/${created.id}$`),
	);
	await expect(page.getByText("Saved").first()).toBeVisible();

	const publishResponsePromise = page.waitForResponse(
		(response) =>
			response.request().method() === "POST" &&
			response
				.url()
				.includes(`/_emdash/api/content/${collection}/${created.id}/publish`),
	);
	await page
		.getByRole("button", { name: "Publish", exact: true })
		.first()
		.click();
	const publishedBody = await expectJsonResponse(
		await publishResponsePromise,
		`publish ${collection}`,
	);
	const published = publishedBody?.data?.item as ContentItem;

	await expect(page.getByText("Content is now live")).toBeVisible();
	await expect(page.getByText("Published").first()).toBeVisible();
	await expect(page.getByRole("link", { name: "Live View" })).toBeVisible();

	return {
		created,
		published,
		publicPath: publicPathForItem(collection, published),
	};
}

export async function expectPublicContent(
	page: Page,
	pathName: string,
	title: string,
	bodyText: string,
) {
	const response = await page.goto(pathName, { waitUntil: "domcontentloaded" });
	expect(response, `Expected ${pathName} to return a response`).not.toBeNull();
	expect(
		response?.status(),
		`Expected ${pathName} to load`,
	).toBeGreaterThanOrEqual(200);
	expect(response?.status(), `Expected ${pathName} to load`).toBeLessThan(300);
	await expect(
		page.getByRole("heading", { level: 1, name: title }),
	).toBeVisible();
	await expect(page.getByText(bodyText)).toBeVisible();
	await expect(page.getByText("Authentication required")).toHaveCount(0);
}
