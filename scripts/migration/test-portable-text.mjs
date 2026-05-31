import assert from "node:assert/strict";

import { htmlToPortableText } from "./lib/portable-text.mjs";

const galleryHtml = `
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
`;

const [gallery] = htmlToPortableText(galleryHtml);
assert.equal(gallery._type, "gallery");
assert.equal(gallery.images.length, 2);
assert.equal(gallery.images[0]._type, "image");
assert.ok(gallery.images[0].asset);
assert.equal(
	gallery.images[0].asset.url,
	"https://media.engagedphilosophy.com/wp-content/uploads/2024/05/thumb-one.jpg",
);
assert.equal(gallery.images[0].alt, "One");
assert.equal(gallery.images[0].caption, "First caption");
assert.equal(gallery.images[0].width, 640);
assert.equal(gallery.images[0].height, 480);
assert.equal(gallery.images[1]._type, "image");
assert.ok(gallery.images[1].asset);

const [linkedImage] = htmlToPortableText(`
<a href="https://www.engagedphilosophy.com/wp-content/uploads/2024/05/full.jpg">
	<img src="https://www.engagedphilosophy.com/wp-content/uploads/2024/05/thumb.jpg" alt="Standalone" />
</a>
`);
assert.equal(linkedImage._type, "legacyImage");
assert.equal(
	linkedImage.url,
	"https://media.engagedphilosophy.com/wp-content/uploads/2024/05/thumb.jpg",
);
assert.equal(
	linkedImage.href,
	"https://media.engagedphilosophy.com/wp-content/uploads/2024/05/full.jpg",
);

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
assert.equal(roundedImage._type, "legacyImage");
assert.equal(roundedImage.align, "center");
assert.equal(roundedImage.shape, "rounded");
assert.equal(roundedImage.width, 404);
assert.equal(roundedImage.height, 553);

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
	assert.equal(shortcodeGallery._type, "gallery");
	assert.equal(shortcodeGallery.layout, "shortcode");
	assert.equal(shortcodeGallery.columns, columns);
	assert.equal(shortcodeGallery.images.length, 2);
}

const [defaultColumnsGallery] = htmlToPortableText(
	`[gallery ids="10,20"]`,
	shortcodeMedia,
);
assert.equal(defaultColumnsGallery.columns, 3);

const [invalidColumnsGallery] = htmlToPortableText(
	`[gallery ids="10,20" columns="banana"]`,
	shortcodeMedia,
);
assert.equal(invalidColumnsGallery.columns, 3);

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
assert.equal(shortcodeVideo._type, "legacyVideo");
assert.equal(
	shortcodeVideo.url,
	"https://media.engagedphilosophy.com/wp-content/uploads/2022/02/video.mp4",
);
assert.equal(shortcodeVideo.title, "Imported video");
assert.equal(shortcodeVideo.mimeType, "video/mp4");
assert.equal(shortcodeVideo.width, 720);
assert.equal(shortcodeVideo.height, 720);

const missingShortcodeVideo = htmlToPortableText(
	`[playlist type="video" ids="missing"]`,
	{},
);
assert.deepEqual(missingShortcodeVideo, []);

const [youtubeShortcodeEmbed] = htmlToPortableText(`[youtube 67-3Jr2QWcg]`);
assert.equal(youtubeShortcodeEmbed._type, "legacyEmbed");
assert.equal(youtubeShortcodeEmbed.provider, "youtube");
assert.equal(
	youtubeShortcodeEmbed.url,
	"https://www.youtube.com/watch?v=67-3Jr2QWcg",
);
assert.equal(
	youtubeShortcodeEmbed.embedUrl,
	"https://www.youtube.com/embed/67-3Jr2QWcg",
);

const [youtubeEmbed] = htmlToPortableText(
	`[embed]https://www.youtube.com/watch?v=LFi0DJxA9lg&t=1s[/embed]`,
);
assert.equal(youtubeEmbed._type, "legacyEmbed");
assert.equal(youtubeEmbed.provider, "youtube");
assert.equal(
	youtubeEmbed.embedUrl,
	"https://www.youtube.com/embed/LFi0DJxA9lg?start=1",
);

const standaloneYoutubeBlocks = htmlToPortableText(
	`Intro paragraph.\n\nhttps://youtu.be/VwZO9oBPbtg\n\nOutro paragraph.`,
);
assert.equal(standaloneYoutubeBlocks.length, 3);
assert.equal(standaloneYoutubeBlocks[1]._type, "legacyEmbed");
assert.equal(standaloneYoutubeBlocks[1].provider, "youtube");
assert.equal(
	standaloneYoutubeBlocks[1].embedUrl,
	"https://www.youtube.com/embed/VwZO9oBPbtg",
);

const [plainStandaloneYoutube] = htmlToPortableText(
	`https://youtu.be/VwZO9oBPbtg`,
	{},
	{ autoEmbedStandaloneUrls: false },
);
assert.equal(plainStandaloneYoutube._type, "block");
assert.equal(
	plainStandaloneYoutube.children.map((child) => child.text).join(""),
	"https://youtu.be/VwZO9oBPbtg",
);

const [malformedYoutubeEmbed] = htmlToPortableText(
	`[embed]http://https://youtu.be/OTRLMgHMn4s[/embed]`,
);
assert.equal(malformedYoutubeEmbed._type, "legacyEmbed");
assert.equal(
	malformedYoutubeEmbed.embedUrl,
	"https://www.youtube.com/embed/OTRLMgHMn4s",
);

const [vimeoEmbed] = htmlToPortableText(
	`[embed]https://vimeo.com/246180371[/embed]`,
);
assert.equal(vimeoEmbed._type, "legacyEmbed");
assert.equal(vimeoEmbed.provider, "vimeo");
assert.equal(vimeoEmbed.embedUrl, "https://player.vimeo.com/video/246180371");

const [animotoEmbed] = htmlToPortableText(
	`[embed]https://animoto.com/play/sYH1W3uAKarloLeVbwgDAQ[/embed]`,
);
assert.equal(animotoEmbed._type, "legacyEmbed");
assert.equal(animotoEmbed.provider, "animoto");
assert.equal(
	animotoEmbed.embedUrl,
	"https://animoto.com/play/sYH1W3uAKarloLeVbwgDAQ",
);

const [directVideoEmbed] = htmlToPortableText(
	`[embed]https://cdn.example.test/video.mp4[/embed]`,
);
assert.equal(directVideoEmbed._type, "legacyVideo");
assert.equal(directVideoEmbed.url, "https://cdn.example.test/video.mp4");
assert.equal(directVideoEmbed.mimeType, "video/mp4");

const [pageList] = htmlToPortableText(`[list-pages]`);
assert.equal(pageList._type, "legacyPageList");
