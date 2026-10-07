import { readFile } from "node:fs/promises";

import { test, expect } from "../../fixtures/worker";
import { collectPageErrors } from "../../support/assertions";
import {
	createContentViaApi,
	deleteContentViaApi,
	dismissWelcome,
	portableTextParagraph,
	publishContentViaApi,
	publicPathForItem,
	uniqueTitle,
	uploadMediaViaApi,
} from "../../support/content";

test("preserves imported media and external videos through editing and publishing", async ({
	authedRequest,
	page,
	publicPage,
}, testInfo) => {
	const errors = collectPageErrors(page);
	const title = uniqueTitle("E2E Native Videos", testInfo.testId);
	const videoFile = await readFile(
		new URL("../../fixtures/video.mp4", import.meta.url),
	);
	const media = await uploadMediaViaApi(authedRequest, {
		filename: "native-video.mp4",
		mimeType: "video/mp4",
		buffer: await readFile(
			new URL("../../fixtures/video.mp4", import.meta.url),
		),
	});
	const videos = [
		{
			_type: "video",
			_key: "media-video",
			asset: {
				_ref: media.id,
				url: "https://media.engagedphilosophy.com/wp-content/uploads/2022/02/Alexs-video.mov",
			},
			caption: "Imported portrait video",
			width: 720,
			height: 1280,
		},
		{
			_type: "video",
			_key: "external-video",
			asset: {
				_ref: "",
				url: "https://d1rb0mbbpzmbiv.cloudfront.net/2017/11/30/SCFRBpSUK9-original-720p-vVeTyERp.mp4",
			},
		},
	];
	for (const target of [page, publicPage]) {
		for (const video of videos) {
			await target.route(video.asset.url, (route) =>
				route.fulfill({ body: videoFile, contentType: "video/mp4" }),
			);
		}
	}
	const created = await createContentViaApi(authedRequest, "pages", {
		title,
		data: {
			content: [...portableTextParagraph("Video introduction."), ...videos],
		},
	});

	try {
		await page.goto(`/_emdash/admin/content/pages/${created.id}`, {
			waitUntil: "domcontentloaded",
		});
		await dismissWelcome(page);
		const editor = page.locator('[contenteditable="true"]').first();
		await expect(editor.locator("video")).toHaveCount(2);
		await editor.getByText("Video introduction.", { exact: true }).click();
		await page.keyboard.press("End");
		await page.keyboard.type(" Updated in the editor.");
		const saved = page.waitForResponse(
			(response) =>
				response.request().method() === "PUT" &&
				new URL(response.url()).pathname ===
					`/_emdash/api/content/pages/${created.id}`,
		);
		await page
			.getByRole("button", { name: "Save", exact: true })
			.first()
			.click();
		const response = await saved;
		expect(response.ok()).toBe(true);
		const body = await response.json();
		const content = body.data.item.data.content as Array<
			Record<string, unknown>
		>;
		expect(content.filter((block) => block._type === "video")).toEqual(videos);
		expect(JSON.stringify(content)).toContain("Updated in the editor.");

		await page.reload({ waitUntil: "domcontentloaded" });
		await expect(editor.locator("video")).toHaveCount(2);
		const published = await publishContentViaApi(
			authedRequest,
			"pages",
			created.id,
		);
		await publicPage.goto(publicPathForItem("pages", published), {
			waitUntil: "domcontentloaded",
		});
		for (const [index, video] of videos.entries()) {
			await expect(
				publicPage.locator(".emdash-video video").nth(index),
			).toHaveAttribute("src", video.asset.url);
			await expect(
				publicPage.locator(".emdash-video video").nth(index),
			).toHaveAttribute("playsinline", "");
		}
		const portrait = publicPage.getByRole("group", {
			name: "Imported portrait video",
		});
		await expect(portrait.locator("figcaption")).toHaveText(
			videos[0]!.caption!,
		);
		await expect(portrait.locator("video")).toHaveAttribute("width", "720");
		await expect(portrait.locator("video")).toHaveAttribute("height", "1280");
		expect(
			await portrait
				.locator("video")
				.evaluate((video) => getComputedStyle(video).maxHeight),
		).toBe("none");
		errors.expectNone();
	} finally {
		await deleteContentViaApi(authedRequest, "pages", created.id);
	}
});
