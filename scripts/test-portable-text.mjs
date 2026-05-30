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
