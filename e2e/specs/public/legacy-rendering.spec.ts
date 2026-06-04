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
const LEGACY_VIDEO_PATH = "/wp-content/uploads/2026/06/e2e-video.mp4";
const MEDIA_BASE = "https://media.engagedphilosophy.com";

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
							_type: "gallery",
							_key: "legacy-gallery",
							layout: "shortcode",
							columns: 2,
							images: LEGACY_GALLERY_PATHS.map((url, index) => ({
								_type: "image",
								_key: `legacy-gallery-${index + 1}`,
								asset: {
									url,
								},
								alt: `Legacy gallery image ${index + 1}`,
							})),
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

		const gallery = publicPage.locator(
			".legacy-gallery.legacy-gallery-shortcode.legacy-gallery-columns-2",
		);
		await expect(gallery.locator("img")).toHaveCount(2);
		await expect(gallery.locator("img").first()).toHaveAttribute(
			"src",
			`${MEDIA_BASE}${LEGACY_GALLERY_PATHS[0]}`,
		);

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
	});
});
