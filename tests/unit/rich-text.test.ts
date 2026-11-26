import { describe, expect, test } from "vitest";

import { getExcerptText, stripHtml } from "../../src/lib/rich-text";

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

	test("keeps editorial brackets in quoted text", () => {
		const quote = 'She said "[W]e think [the students] learn more" [laughs].';

		expect(
			stripHtml([
				{
					_type: "block",
					_key: "quote",
					style: "normal",
					markDefs: [],
					children: [
						{
							_type: "span",
							_key: "quote-text",
							text: quote,
							marks: [],
						},
					],
				},
			]),
		).toBe(quote);
		expect(stripHtml(`<p>${quote}</p>`)).toBe(quote);
		expect(stripHtml("[Video] Interview with [the author]")).toBe(
			"[Video] Interview with [the author]",
		);

		const transcript =
			"[cross-talk] [the teacher's] point [audio cuts out] [video plays] [sic]";
		expect(stripHtml(transcript)).toBe(transcript);

		const notes =
			"[n = 30] [with n=30 participants] [audio 0:45] the [video] [caption 2]";
		expect(stripHtml(notes)).toBe(notes);
		const alternatives = "his[/her] students and[/or] the audio[/video] talk";
		expect(stripHtml(alternatives)).toBe(alternatives);

		const tagWords = [
			"[video of class=chaos]",
			'[video of class="chaos"]',
			"[youtube video] [youtube Documentary] [youtube re-uploaded]",
			"[youtube=documentary] [vimeo 2019]",
			"[video] then literal [[/video]]",
		].join(" ");
		expect(stripHtml(tagWords)).toBe(tagWords);
		const linked = '<p>[audio of the talk <a href="/x.mp3">download</a>]</p>';
		expect(stripHtml(linked)).toBe("[audio of the talk download ]");

		const labels = [
			"We used a [playlist] and a [gallery] in the [embed] section.",
			"[youtube https://youtu.be/abc for the full lecture]",
		].join(" ");
		expect(stripHtml(labels)).toBe(labels);

		const camelCase =
			"[youtube DOCUMENTARY] [youtube WomenInTech] [youtube 2020-update]";
		expect(stripHtml(camelCase)).toBe(camelCase);
		expect(stripHtml('[video] intro <img alt="[/video]">')).toBe(
			"[video] intro",
		);
		const hiddenCloser =
			'a [video src="a.mp4"] b <img alt="[/video]"> [/video]';
		expect(stripHtml(hiddenCloser)).toBe("a b");
		expect(stripHtml('<img alt="[gallery]"> text [/gallery]')).toBe("text");
		expect(stripHtml("Plato, Raphael[/caption] In this essay")).toBe(
			"Plato, Raphael In this essay",
		);

		const labelBeforeEmbed = '[video] Watch it: [video src="a.mp4"][/video]';
		expect(stripHtml(labelBeforeEmbed)).toBe("[video] Watch it:");
		expect(stripHtml("[video<br />] intro")).toBe("[video ] intro");
		expect(stripHtml("<p>[video] intro</p><!-- [/video] -->")).toBe(
			"[video] intro",
		);

		const mixed = '[video plays] then [video src="b.mp4"][/video] ends';
		expect(stripHtml(mixed)).toBe("[video plays] then ends");

		const proseInside = '[video src="a.mp4"] text [video plays] [/video]';
		expect(stripHtml(proseInside)).toBe("text [video plays]");
		const logic = "<p>Suppose x<y holds.</p><p>Then <em>so</em> p -> q.</p>";
		expect(stripHtml(logic)).toBe("Suppose x<y holds. Then so p -> q.");
		const titledLink =
			'<p>Consider <a href="/x" title="if p<q">this</a> proof.</p>';
		expect(stripHtml(titledLink)).toBe("Consider this proof.");
		const strayLessThan =
			'if a<b then [caption id="a" caption="x > y"]Photo[/caption] done';
		expect(stripHtml(strayLessThan)).toBe("if a<b then Photo done");
		const reusedCloser =
			'[video src="a.mp4"] intro [video src="b.mp4"][/video] the audio[/video]';
		expect(stripHtml(reusedCloser)).toBe("intro the audio[/video]");
		const unclosedNote = '[caption id="a"]Photo [audio note[/caption] after';
		expect(stripHtml(unclosedNote)).toBe("Photo [audio note after");
	});

	test("leaves other shortcodes and escaped shortcodes as text", () => {
		expect(stripHtml("[toc] Text [vc_row]")).toBe("[toc] Text [vc_row]");
		expect(stripHtml("literal [[gallery]] syntax")).toBe(
			"literal [[gallery]] syntax",
		);
		const escapedPair = 'literal [[video src="a.mp4"]clip[/video]]';
		expect(stripHtml(escapedPair)).toBe(escapedPair);
	});

	test("removes leftover WordPress shortcodes", () => {
		const content = [
			"Before",
			'[gallery ids="1,2,3"]',
			"middle",
			'[caption id="attachment_1" align="alignnone"]Caption text[/caption]',
			// Text between paired tags is kept; only the tags are removed.
			"[embed]https://example.com/video[/embed]",
			"[youtube 67-3Jr2QWcg] [youtube dQwkWzXcQgA] [vimeo 141358]",
			"[youtube=https://www.youtube.com/watch?v=67-3Jr2QWcg]",
			"[list-pages] [child-pages] [gallery/]",
			"[video]clip[/video]",
			'[caption id="x" caption="<em>Hi</em>"]Photo[/caption]',
			'[video autoplay="on" loop src="x.mp4"][/video]',
			"[gallery ids=\u201d1,2\u2033 caption=\u201dmy trip\u201d]",
			"[gallery ids=\u20191,2\u2032 caption=\u2019my trip\u2019]",
			'[video] [video src="b.mp4" /] [/video]',
			"[video autoplay]clip[/video]",
			"[vimeo=https://vimeo.com/1] [youtube 67-3Jr2QWcg&w=640]",
			'[playlist ids="4"]',
			'[audio src="a.mp3"]',
			'[video src="b.mp4"][/video]',
			"[youtube https://www.youtube.com/watch?v=67-3Jr2QWcg w=640]",
			"[vimeo 141358 w=500&h=350]",
			"[vimeo 141358 loop] [audio https://example.com/a.mp3 autoplay]",
			"[youtube dQw4w9WgXcQ?t=10] [vimeo 141358&w=500]",
			'[caption id="a" caption="Kant&#039;s &quot;Critique&quot;"]Photo[/caption]',
			"[caption caption=\u201cHe said \u201chi\u201d\u201d]Photo[/caption]",
			'[video src="a.mp4" loop][/video] [audio src="a.mp3" loop muted]',
			'[caption id="a" caption="x < y"]Photo[/caption]',
			'[caption id="a" caption="A<B test"]Photo[/caption]',
			'[caption id="c" caption="Hofstadter&#039;s &quot;strange&quot; loop"]Photo[/caption]',
			'[caption id="d" caption="Is &quot;x&quot; x = y?"]Photo[/caption]',
			"[audio:http://example.com/talk.mp3|titles=The Talk]",
			"[youtube=www.youtube.com/watch?v=dQw4w9WgXcQ] [vimeo //vimeo.com/141358]",
			'[youtube="http://www.youtube.com/watch?v=dQw4w9WgXcQ"]',
			"[youtube=\u2019dQw4w9WgXcQ\u2019] [youtube m.youtube.com/watch?v=dQw4w9WgXcQ]",
			"[audio:/wp-content/uploads/talk.mp3|titles=Talk] [audio:talk.mp3]",
			"[audio https://example.com/ep1/][/audio]",
			"[audio:intro.mp3,outro.mp3|titles=Intro,Outro]",
			'<p>[gallery<br />\nids="1,2,3"<br />\ncolumns="3"]</p>',
			'[youtube <a href="https://youtu.be/dQw4w9WgXcQ">https://youtu.be/dQw4w9WgXcQ</a>]',
			'[video mp4="a.mp4" preload="none" playsinline][/video]',
			'[caption id="b" caption="x > y"]Photo[/caption] [video src="a.mp4" Loop]',
			"[video mp4=https://example.com/a.mp4?v=2]",
			"[audio https://example.com/a.mp3|titles=Talk]",
			"after",
		].join(" ");

		expect(stripHtml(content)).toBe(
			"Before middle Caption text https://example.com/video clip Photo clip Photo Photo Photo Photo Photo Photo Photo after",
		);
		expect(stripHtml("A [captioned] note and [gallery-of-work]")).toBe(
			"A [captioned] note and [gallery-of-work]",
		);
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
