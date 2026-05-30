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
