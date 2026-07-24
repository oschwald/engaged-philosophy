import type { Page } from "@playwright/test";

import { test, expect } from "../../fixtures/worker";
import {
	createAndPublishContentViaApi,
	expectPublicContent,
	uniqueTitle,
} from "../../support/content";

const NATIVE_IMAGE_PATH = "/wp-content/uploads/2026/06/e2e-native-image.jpg";
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
const RIGHT_IMAGE_PATH = "/wp-content/uploads/2026/06/e2e-right-image.jpg";
const LEGACY_VIDEO_PATH = "/wp-content/uploads/2026/06/e2e-video.mp4";
const MEDIA_BASE = "https://media.engagedphilosophy.com";

async function expectPageTextNotToContain(page: Page, text: string) {
	const pageText = await page.locator("body").innerText();
	expect(pageText).not.toContain(text);
}

test.describe("public migrated content rendering", () => {
	test("renders native images and embeds alongside remaining legacy media", async ({
		authedRequest,
		publicPage,
	}, testInfo) => {
		const title = uniqueTitle("E2E Legacy Rendering", testInfo.testId);
		const bodyText = `${title} body with migrated media blocks.`;
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
							_type: "image",
							_key: "native-image",
							asset: {
								_ref: `${MEDIA_BASE}${NATIVE_IMAGE_PATH}`,
								url: `${MEDIA_BASE}${NATIVE_IMAGE_PATH}`,
							},
							alt: "Native floated image",
							alignment: "left",
							width: 120,
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
							_type: "youtube",
							_key: "youtube",
							id: "dQw4w9WgXcQ",
							title: "E2E migrated YouTube embed",
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

		const nativeFigure = publicPage.locator(
			".entry-content .emdash-image--align-left",
		);
		const nativeImage = nativeFigure.locator("img");
		await expect(nativeImage).toHaveAttribute(
			"src",
			`${MEDIA_BASE}${NATIVE_IMAGE_PATH}`,
		);
		await expect(nativeImage).toHaveAttribute("alt", "Native floated image");
		await expect(
			nativeFigure.evaluate((figure) => {
				const style = getComputedStyle(figure);
				return {
					floatValue: style.float,
					maxWidth: style.maxWidth,
				};
			}),
		).resolves.toEqual({
			floatValue: "left",
			maxWidth: "calc(100% - 24px)",
		});
		await expect(
			publicPage.locator('a:has(img[alt="Native floated image"])'),
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

		await expect(publicPage.locator("lite-youtube")).toHaveAttribute(
			"videoid",
			"dQw4w9WgXcQ",
		);
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

		await publicPage.setViewportSize({ width: 390, height: 844 });
		await expect(
			nativeFigure.evaluate((figure) => {
				const content =
					figure.closest(".legacy-content") ?? figure.closest(".entry-content");
				if (!content) return null;
				const figureBox = figure.getBoundingClientRect();
				const contentBox = content.getBoundingClientRect();
				return {
					floatValue: getComputedStyle(figure).float,
					leftOffset: Math.abs(figureBox.left - contentBox.left),
				};
			}),
		).resolves.toEqual({
			floatValue: "none",
			leftOffset: 0,
		});

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
		await expect(nativeImage).toHaveAttribute(
			"src",
			`${MEDIA_BASE}${NATIVE_IMAGE_PATH}`,
		);
	});

	test("centers native images with captions and preserves page lists and mobile nav", async ({
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
							_type: "image",
							_key: "centered-image",
							asset: {
								_ref: `${MEDIA_BASE}${CENTERED_IMAGE_PATH}`,
								url: `${MEDIA_BASE}${CENTERED_IMAGE_PATH}`,
							},
							alt: "Centered native image",
							alignment: "center",
							caption:
								"A deliberately long caption that is wider than the image",
							width: 404,
						},
						{
							_type: "legacyPageList",
							_key: "legacy-page-list",
						},
						{
							_type: "image",
							_key: "right-image",
							asset: {
								_ref: `${MEDIA_BASE}${RIGHT_IMAGE_PATH}`,
								url: `${MEDIA_BASE}${RIGHT_IMAGE_PATH}`,
							},
							alt: "Right-aligned native image",
							alignment: "right",
							width: 120,
						},
					],
				},
			},
		);

		await expectPublicContent(publicPage, publicPath, title, bodyText);

		const centeredFigure = publicPage.locator(
			".entry-content .emdash-image--align-center",
		);
		const centeredImage = centeredFigure.locator("img");
		await expect(centeredImage).toHaveAttribute(
			"src",
			`${MEDIA_BASE}${CENTERED_IMAGE_PATH}`,
		);
		await expect(centeredImage).toHaveAttribute("alt", "Centered native image");

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

		const rightFigure = publicPage.locator(
			".entry-content .emdash-image--align-right",
		);
		await expect(
			rightFigure.evaluate((figure) => getComputedStyle(figure).float),
		).resolves.toBe("right");

		const pageList = publicPage.locator(".legacy-page-list");
		await expect(pageList.locator(`a[href="${publicPath}"]`)).toHaveText(title);
		await expectPageTextNotToContain(publicPage, "[list-pages");

		await publicPage.setViewportSize({ width: 390, height: 844 });
		await expect(
			rightFigure.evaluate((figure) => {
				const content =
					figure.closest(".legacy-content") ?? figure.closest(".entry-content");
				if (!content) return null;
				const figureBox = figure.getBoundingClientRect();
				const contentBox = content.getBoundingClientRect();
				return {
					floatValue: getComputedStyle(figure).float,
					rightOffset: Math.abs(figureBox.right - contentBox.right),
				};
			}),
		).resolves.toEqual({
			floatValue: "none",
			rightOffset: 0,
		});
		await publicPage.locator(".navbar-toggler").click();
		await expect(publicPage.locator("#navbarNav")).toHaveClass(/show/);
		await publicPage.locator(".navbar-toggler").click();
		await expect(publicPage.locator("#navbarNav")).not.toHaveClass(/show/);
	});
});
