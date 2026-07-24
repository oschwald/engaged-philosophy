import { describe, expect, test } from "vitest";

import { getExcerptText, stripHtml } from "../../src/lib/rich-text";

describe("rich text", () => {
	test("uses EmDash text extraction for standard Portable Text blocks", () => {
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
});
