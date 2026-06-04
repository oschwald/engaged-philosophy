import { describe, expect, test } from "vitest";

import { htmlToPortableText } from "../../../scripts/migration/lib/portable-text.mjs";

describe("WordPress HTML to Portable Text migration", () => {
	test("preserves block gallery images in renderer-readable shape", () => {
		const [gallery] = htmlToPortableText(`
<figure class="wp-block-gallery columns-2">
	<ul class="blocks-gallery-grid">
		<li class="blocks-gallery-item">
			<figure>
				<a href="https://www.engagedphilosophy.com/wp-content/uploads/2024/05/full-one.jpg">
					<img src="https://www.engagedphilosophy.com/wp-content/uploads/2024/05/thumb-one.jpg" alt="One" width="640" height="480" />
				</a>
				<figcaption>First caption</figcaption>
			</figure>
		</li>
		<li class="blocks-gallery-item">
			<figure>
				<a href="https://www.engagedphilosophy.com/wp-content/uploads/2024/05/full-two.jpg">
					<img src="https://www.engagedphilosophy.com/wp-content/uploads/2024/05/thumb-two.jpg" alt="Two" />
				</a>
			</figure>
		</li>
	</ul>
</figure>
`);

		expect(gallery._type).toBe("gallery");
		expect(gallery.images).toHaveLength(2);
		expect(gallery.images[0]).toMatchObject({
			_type: "image",
			alt: "One",
			caption: "First caption",
			width: 640,
			height: 480,
			asset: {
				url: "/_emdash/api/media/file/wp-content/uploads/2024/05/thumb-one.jpg",
			},
		});
		expect(gallery.images[1]._type).toBe("image");
		expect(gallery.images[1].asset).toBeTruthy();
	});

	test("preserves linked and styled standalone images as legacy images", () => {
		const [linkedImage] = htmlToPortableText(`
<a href="https://www.engagedphilosophy.com/wp-content/uploads/2024/05/full.jpg">
	<img src="https://www.engagedphilosophy.com/wp-content/uploads/2024/05/thumb.jpg" alt="Standalone" />
</a>
`);
		expect(linkedImage).toMatchObject({
			_type: "legacyImage",
			id: "/_emdash/api/media/file/wp-content/uploads/2024/05/thumb.jpg",
			href: "/_emdash/api/media/file/wp-content/uploads/2024/05/full.jpg",
		});

		const [roundedImage] = htmlToPortableText(`
<div class="wp-block-image is-style-rounded">
	<figure class="aligncenter size-full is-resized">
		<a href="https://www.engagedphilosophy.com/wp-content/uploads/2021/10/Stock-2-1.jpg">
			<img src="https://www.engagedphilosophy.com/wp-content/uploads/2021/10/Stock-2-1.jpg" alt="" class="wp-image-2954" width="404" height="553"/>
		</a>
		<figcaption>The author, Timothy Stock.</figcaption>
	</figure>
</div>
`);
		expect(roundedImage).toMatchObject({
			_type: "legacyImage",
			align: "center",
			shape: "rounded",
			id: "/_emdash/api/media/file/wp-content/uploads/2021/10/Stock-2-1.jpg",
			width: 404,
			height: 553,
		});
	});

	test("preserves gallery shortcode column counts", () => {
		const shortcodeMedia = {
			10: {
				url: "https://www.engagedphilosophy.com/wp-content/uploads/2024/05/ten.jpg",
				alt: "Ten",
			},
			20: {
				url: "https://www.engagedphilosophy.com/wp-content/uploads/2024/05/twenty.jpg",
				alt: "Twenty",
			},
		};

		for (const columns of [1, 2, 4]) {
			const [shortcodeGallery] = htmlToPortableText(
				`[gallery ids="10,20" columns="${columns}"]`,
				shortcodeMedia,
			);
			expect(shortcodeGallery).toMatchObject({
				_type: "gallery",
				layout: "shortcode",
				columns,
			});
			expect(shortcodeGallery.images).toHaveLength(2);
			expect(shortcodeGallery.images[0].asset._ref).toBe("wp-media-10");
		}

		const [defaultColumnsGallery] = htmlToPortableText(
			`[gallery ids="10,20"]`,
			shortcodeMedia,
		);
		expect(defaultColumnsGallery.columns).toBe(3);

		const [invalidColumnsGallery] = htmlToPortableText(
			`[gallery ids="10,20" columns="banana"]`,
			shortcodeMedia,
		);
		expect(invalidColumnsGallery.columns).toBe(3);
	});

	test("imports playlist video shortcodes as legacy videos", () => {
		const [shortcodeVideo] = htmlToPortableText(
			`[playlist type="video" ids="3120"]`,
			{
				3120: {
					url: "https://www.engagedphilosophy.com/wp-content/uploads/2022/02/video.mp4",
					title: "Imported video",
					mimeType: "video/mp4",
					width: 720,
					height: 720,
				},
			},
		);
		expect(shortcodeVideo).toMatchObject({
			_type: "legacyVideo",
			url: "/_emdash/api/media/file/wp-content/uploads/2022/02/video.mp4",
			title: "Imported video",
			mimeType: "video/mp4",
			width: 720,
			height: 720,
		});

		expect(
			htmlToPortableText(`[playlist type="video" ids="missing"]`, {}),
		).toEqual([]);
	});

	test("imports YouTube, Vimeo, Animoto, and direct video embeds", () => {
		const [youtubeShortcodeEmbed] = htmlToPortableText(`[youtube 67-3Jr2QWcg]`);
		expect(youtubeShortcodeEmbed).toMatchObject({
			_type: "legacyEmbed",
			provider: "youtube",
			url: "https://www.youtube.com/watch?v=67-3Jr2QWcg",
			embedUrl: "https://www.youtube.com/embed/67-3Jr2QWcg",
		});

		const [youtubeEmbed] = htmlToPortableText(
			`[embed]https://www.youtube.com/watch?v=LFi0DJxA9lg&t=1s[/embed]`,
		);
		expect(youtubeEmbed).toMatchObject({
			_type: "legacyEmbed",
			provider: "youtube",
			embedUrl: "https://www.youtube.com/embed/LFi0DJxA9lg?start=1",
		});

		const standaloneYoutubeBlocks = htmlToPortableText(
			`Intro paragraph.\n\nhttps://youtu.be/VwZO9oBPbtg\n\nOutro paragraph.`,
		);
		expect(standaloneYoutubeBlocks).toHaveLength(3);
		expect(standaloneYoutubeBlocks[1]).toMatchObject({
			_type: "legacyEmbed",
			provider: "youtube",
			embedUrl: "https://www.youtube.com/embed/VwZO9oBPbtg",
		});

		const [plainStandaloneYoutube] = htmlToPortableText(
			`https://youtu.be/VwZO9oBPbtg`,
			{},
			{ autoEmbedStandaloneUrls: false },
		);
		expect(plainStandaloneYoutube._type).toBe("block");
		expect(
			plainStandaloneYoutube.children.map((child) => child.text).join(""),
		).toBe("https://youtu.be/VwZO9oBPbtg");

		const [malformedYoutubeEmbed] = htmlToPortableText(
			`[embed]http://https://youtu.be/OTRLMgHMn4s[/embed]`,
		);
		expect(malformedYoutubeEmbed).toMatchObject({
			_type: "legacyEmbed",
			embedUrl: "https://www.youtube.com/embed/OTRLMgHMn4s",
		});

		const [vimeoEmbed] = htmlToPortableText(
			`[embed]https://vimeo.com/246180371[/embed]`,
		);
		expect(vimeoEmbed).toMatchObject({
			_type: "legacyEmbed",
			provider: "vimeo",
			embedUrl: "https://player.vimeo.com/video/246180371",
		});

		const [animotoEmbed] = htmlToPortableText(
			`[embed]https://animoto.com/play/sYH1W3uAKarloLeVbwgDAQ[/embed]`,
		);
		expect(animotoEmbed).toMatchObject({
			_type: "legacyEmbed",
			provider: "animoto",
			embedUrl: "https://animoto.com/play/sYH1W3uAKarloLeVbwgDAQ",
		});

		const [directVideoEmbed] = htmlToPortableText(
			`[embed]https://cdn.example.test/video.mp4[/embed]`,
		);
		expect(directVideoEmbed).toMatchObject({
			_type: "legacyVideo",
			url: "https://cdn.example.test/video.mp4",
			mimeType: "video/mp4",
		});
	});

	test("imports legacy page list shortcode", () => {
		const [pageList] = htmlToPortableText(`[list-pages]`);
		expect(pageList._type).toBe("legacyPageList");
	});
});
