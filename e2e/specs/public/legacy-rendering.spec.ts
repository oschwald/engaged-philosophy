import type { Page } from "@playwright/test";

import { test, expect } from "../../fixtures/worker";
import {
	createAndPublishContentViaApi,
	expectPublicContent,
	uniqueTitle,
} from "../../support/content";

const LEGACY_IMAGE_PATH = "/wp-content/uploads/2026/06/e2e-legacy-image.jpg";
const LEGACY_GALLERY_PATHS = [
	"/wp-content/uploads/2026/06/e2e-gallery-one.jpg",
	"/wp-content/uploads/2026/06/e2e-gallery-two.jpg",
];
const LEGACY_BLOCK_GALLERY_PATHS = [
	"/wp-content/uploads/2026/06/e2e-block-gallery-one.jpg",
	"/wp-content/uploads/2026/06/e2e-block-gallery-two.jpg",
];
const CENTERED_IMAGE_PATH =
	"/wp-content/uploads/2026/06/e2e-centered-image.jpg";
const LEGACY_VIDEO_PATH = "/wp-content/uploads/2026/06/e2e-video.mp4";
const MEDIA_BASE = "https://media.engagedphilosophy.com";

async function expectPageTextNotToContain(page: Page, text: string) {
	const pageText = await page.locator("body").innerText();
	expect(pageText).not.toContain(text);
}

test.describe("public legacy rendering", () => {
	test("renders migrated media and embed blocks with legacy classes", async ({
		authedRequest,
		publicPage,
	}, testInfo) => {
		const title = uniqueTitle("E2E Legacy Rendering", testInfo.testId);
		const bodyText = `${title} body with migrated media blocks.`;
		const embedUrl = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";
		const videoTitle = "E2E imported video";

		const { publicPath } = await createAndPublishContentViaApi(
			authedRequest,
			"pages",
			{
				title,
				content: bodyText,
				data: {
					content: [
						{
							_type: "block",
							_key: "intro",
							style: "normal",
							markDefs: [],
							children: [
								{
									_type: "span",
									_key: "intro-span",
									text: bodyText,
									marks: [],
								},
							],
						},
						{
							_type: "legacyImage",
							_key: "legacy-image",
							url: LEGACY_IMAGE_PATH,
							alt: "Legacy floated image",
							align: "left",
							shape: "rounded",
							width: 120,
							height: 120,
						},
						{
							_type: "legacyImage",
							_key: "unsafe-legacy-image",
							url: "javascript:alert(1)",
							alt: "Unsafe legacy image",
							align: "left",
							width: 120,
							height: 120,
						},
						{
							_type: "legacyImage",
							_key: "unsafe-legacy-image-link",
							url: LEGACY_IMAGE_PATH,
							href: "javascript:alert(1)",
							alt: "Legacy image with unsafe link",
							align: "right",
							width: 120,
							height: 120,
						},
						{
							_type: "gallery",
							_key: "legacy-gallery",
							layout: "shortcode",
							columns: 2,
							images: [
								...LEGACY_GALLERY_PATHS.map((url, index) => ({
									_type: "image",
									_key: `legacy-gallery-${index + 1}`,
									asset: {
										url,
									},
									alt: `Legacy gallery image ${index + 1}`,
								})),
								{
									_type: "image",
									_key: "legacy-gallery-unsafe",
									asset: {
										url: "javascript:alert(1)",
									},
									alt: "Unsafe legacy gallery image",
								},
							],
						},
						{
							_type: "gallery",
							_key: "legacy-block-gallery",
							layout: "figure",
							columns: 2,
							images: [
								...LEGACY_BLOCK_GALLERY_PATHS.map((url, index) => ({
									_type: "image",
									_key: `legacy-block-gallery-${index + 1}`,
									asset: {
										url,
									},
									alt: `Legacy block gallery image ${index + 1}`,
								})),
								{
									_type: "image",
									_key: "legacy-block-gallery-unsafe",
									asset: {
										url: "javascript:alert(1)",
									},
									alt: "Unsafe legacy block gallery image",
								},
							],
						},
						{
							_type: "legacyEmbed",
							_key: "legacy-embed",
							provider: "youtube",
							embedUrl,
							title: "E2E imported YouTube embed",
						},
						{
							_type: "legacyVideo",
							_key: "legacy-video",
							url: LEGACY_VIDEO_PATH,
							title: videoTitle,
							mimeType: "video/mp4",
							width: 640,
							height: 360,
						},
					],
				},
			},
		);

		await expectPublicContent(publicPage, publicPath, title, bodyText);

		const legacyImage = publicPage.locator(
			".entry-content img.alignleft.legacy-image--rounded",
		);
		await expect(legacyImage).toHaveAttribute(
			"src",
			`${MEDIA_BASE}${LEGACY_IMAGE_PATH}`,
		);
		await expect(legacyImage).toHaveAttribute("alt", "Legacy floated image");
		await expect(
			legacyImage.evaluate((image) => {
				const style = getComputedStyle(image);
				return {
					borderTopLeftRadius: style.borderTopLeftRadius,
					floatValue: style.float,
				};
			}),
		).resolves.toEqual({
			borderTopLeftRadius: "9999px",
			floatValue: "left",
		});
		await expect(publicPage.getByAltText("Unsafe legacy image")).toHaveCount(0);

		const unsafeLinkedImage = publicPage.getByAltText(
			"Legacy image with unsafe link",
		);
		await expect(unsafeLinkedImage).toHaveAttribute(
			"src",
			`${MEDIA_BASE}${LEGACY_IMAGE_PATH}`,
		);
		await expect(
			publicPage.locator('a:has(img[alt="Legacy image with unsafe link"])'),
		).toHaveCount(0);
		await expect(publicPage.locator('.entry-content img[src=""]')).toHaveCount(
			0,
		);
		await expect(publicPage.locator('.entry-content a[href=""]')).toHaveCount(
			0,
		);

		const gallery = publicPage.locator(
			".legacy-gallery.legacy-gallery-shortcode.legacy-gallery-columns-2",
		);
		await expect(gallery.locator("img")).toHaveCount(2);
		await expect(
			publicPage.getByAltText("Unsafe legacy gallery image"),
		).toHaveCount(0);
		await expect(gallery.locator("img").first()).toHaveAttribute(
			"src",
			`${MEDIA_BASE}${LEGACY_GALLERY_PATHS[0]}`,
		);
		await expect(
			gallery.evaluate((element) => getComputedStyle(element).display),
		).resolves.toBe("grid");

		const blockGallery = publicPage.locator(
			".legacy-gallery.blocks-gallery-grid.columns-2",
		);
		await expect(blockGallery.locator("img")).toHaveCount(2);
		await expect(
			publicPage.getByAltText("Unsafe legacy block gallery image"),
		).toHaveCount(0);
		await expect(
			blockGallery.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					display: style.display,
					listStyleType: style.listStyleType,
				};
			}),
		).resolves.toEqual({
			display: "flex",
			listStyleType: "none",
		});

		await expect(
			publicPage.locator(".legacy-embed--youtube iframe"),
		).toHaveAttribute("src", embedUrl);
		await expect(publicPage.locator(".legacy-video video")).toHaveAttribute(
			"aria-label",
			videoTitle,
		);
		await expect(publicPage.locator(".legacy-video source")).toHaveAttribute(
			"src",
			`${MEDIA_BASE}${LEGACY_VIDEO_PATH}`,
		);
		await expectPageTextNotToContain(publicPage, "[gallery");
		await expectPageTextNotToContain(publicPage, "[youtube");
		await expectPageTextNotToContain(publicPage, "[playlist");

		await publicPage.context().addCookies([
			{
				name: "astro-session",
				value: "e2e-session-probe",
				url: publicPage.url(),
			},
		]);
		const signedInResponse = await publicPage.goto(publicPath, {
			waitUntil: "domcontentloaded",
			timeout: 10_000,
		});
		expect(signedInResponse?.status()).toBe(200);
		await expect(publicPage.getByText(bodyText)).toBeVisible();
		await expect(legacyImage).toHaveAttribute(
			"src",
			`${MEDIA_BASE}${LEGACY_IMAGE_PATH}`,
		);
	});

	test("preserves centered legacy images, page lists, and mobile nav", async ({
		authedRequest,
		publicPage,
	}, testInfo) => {
		const title = uniqueTitle("E2E Centered Image", testInfo.testId);
		const bodyText = `${title} body with a centered image and page list.`;

		const { publicPath } = await createAndPublishContentViaApi(
			authedRequest,
			"pages",
			{
				title,
				content: bodyText,
				data: {
					content: [
						{
							_type: "block",
							_key: "intro",
							style: "normal",
							markDefs: [],
							children: [
								{
									_type: "span",
									_key: "intro-span",
									text: bodyText,
									marks: [],
								},
							],
						},
						{
							_type: "legacyImage",
							_key: "centered-image",
							url: CENTERED_IMAGE_PATH,
							alt: "Centered legacy image",
							align: "center",
							shape: "rounded",
							caption: "Centered legacy image caption",
							width: 404,
							height: 553,
						},
						{
							_type: "legacyPageList",
							_key: "legacy-page-list",
						},
					],
				},
			},
		);

		await expectPublicContent(publicPage, publicPath, title, bodyText);

		const centeredFigure = publicPage.locator(
			".entry-content .emdash-image.aligncenter.legacy-image--rounded",
		);
		const centeredImage = centeredFigure.locator("img");
		await expect(centeredImage).toHaveAttribute(
			"src",
			`${MEDIA_BASE}${CENTERED_IMAGE_PATH}`,
		);
		await expect(centeredImage).toHaveAttribute("alt", "Centered legacy image");

		const centerOffset = await centeredFigure.evaluate((figure) => {
			const content = figure.closest(".entry-content");
			const image = figure.querySelector("img");
			if (!content || !image) return Number.POSITIVE_INFINITY;

			const contentBox = content.getBoundingClientRect();
			const imageBox = image.getBoundingClientRect();
			const contentCenter = contentBox.left + contentBox.width / 2;
			const imageCenter = imageBox.left + imageBox.width / 2;
			return Math.abs(contentCenter - imageCenter);
		});
		expect(centerOffset).toBeLessThanOrEqual(2);

		await expect(
			centeredImage.evaluate(
				(image) => getComputedStyle(image).borderTopLeftRadius,
			),
		).resolves.toBe("9999px");

		const pageList = publicPage.locator(".legacy-page-list");
		await expect(pageList.locator(`a[href="${publicPath}"]`)).toHaveText(title);
		await expectPageTextNotToContain(publicPage, "[list-pages");

		await publicPage.setViewportSize({ width: 390, height: 844 });
		await publicPage.locator(".navbar-toggler").click();
		await expect(publicPage.locator("#navbarNav")).toHaveClass(/show/);
		await publicPage.locator(".navbar-toggler").click();
		await expect(publicPage.locator("#navbarNav")).not.toHaveClass(/show/);
	});
});
