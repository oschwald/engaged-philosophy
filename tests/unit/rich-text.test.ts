import { describe, expect, test } from "vitest";

import {
	decodeHtmlEntities,
	getExcerptText,
	stripHtml,
} from "../../src/lib/rich-text";

describe("rich text", () => {
	test("extracts plain text from standard Portable Text blocks", () => {
		expect(
			stripHtml([
				{
					_type: "block",
					_key: "intro",
					style: "normal",
					markDefs: [],
					children: [
						{
							_type: "span",
							_key: "intro-text",
							text: "A standard paragraph.",
							marks: [],
						},
					],
				},
				{
					_type: "code",
					_key: "example",
					language: "text",
					code: "standard code block",
				},
			]),
		).toBe("A standard paragraph. standard code block");
	});

	test("preserves imported image and gallery excerpt text", () => {
		expect(
			stripHtml([
				{
					_type: "image",
					_key: "image",
					alt: "Image alt text",
					caption: "Image caption is not duplicated",
				},
				{
					_type: "gallery",
					_key: "gallery",
					images: [
						{
							_type: "image",
							_key: "gallery-image-with-alt",
							alt: "Gallery alt text",
							caption: "Unused gallery caption",
						},
						{
							_type: "image",
							_key: "gallery-image-with-caption",
							caption: "Gallery caption fallback",
						},
					],
				},
			]),
		).toBe("Image alt text Gallery alt text Gallery caption fallback");
	});

	test("prefers an explicit excerpt over a generated excerpt", () => {
		expect(
			getExcerptText(
				[
					{
						_type: "block",
						_key: "excerpt",
						style: "normal",
						markDefs: [],
						children: [
							{
								_type: "span",
								_key: "excerpt-text",
								text: "One two three four",
								marks: [],
							},
						],
					},
				],
				[
					{
						_type: "block",
						_key: "content",
						style: "normal",
						markDefs: [],
						children: [
							{
								_type: "span",
								_key: "content-text",
								text: "Content fallback",
								marks: [],
							},
						],
					},
				],
				3,
			),
		).toBe("One two three four");
	});

	test("applies the word limit to generated excerpts", () => {
		expect(
			getExcerptText(
				undefined,
				[
					{
						_type: "block",
						_key: "content",
						style: "normal",
						markDefs: [],
						children: [
							{
								_type: "span",
								_key: "content-text",
								text: "One two three four",
								marks: [],
							},
						],
					},
				],
				3,
			),
		).toBe("One two three");
	});

	test("decodes numeric entities within the Unicode range", () => {
		expect(decodeHtmlEntities("&#8217; &#x2014; &#X1F600; &#x10FFFF;")).toBe(
			"\u2019 \u2014 \u{1F600} \u{10FFFF}",
		);
	});

	test("leaves numeric entities outside the Unicode range as written", () => {
		const value =
			"zebraentity &#9999999999; &#1114112; &#x110000; &#x7FFFFFFFFFFFFFFFF; title";

		expect(decodeHtmlEntities(value)).toBe(value);
		expect(decodeHtmlEntities(`&#${"9".repeat(400)};`)).toBe(
			`&#${"9".repeat(400)};`,
		);
		expect(stripHtml("zebraentity &#9999999999; title")).toBe(
			"zebraentity &#9999999999; title",
		);
	});

	test("leaves surrogate code point entities as written", () => {
		const value = "&#xD800; &#55296; &#xDFFF; &#57343;";

		expect(decodeHtmlEntities(value)).toBe(value);
		expect(decodeHtmlEntities("&#xD7FF; &#xE000;")).toBe("\uD7FF \uE000");
	});

	test("leaves decimal entities with hex digits as written", () => {
		expect(decodeHtmlEntities("&#12ab; &#x12ab;")).toBe("&#12ab; \u12ab");
	});
});
