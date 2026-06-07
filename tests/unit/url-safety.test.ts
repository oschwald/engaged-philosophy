import { describe, expect, test } from "vitest";

import {
	safeUrlForHref,
	safeUrlForIframeSrc,
	safeUrlForMediaSrc,
} from "../../src/lib/url-safety";

describe("URL safety helpers", () => {
	test("allows same-page and http links", () => {
		expect(safeUrlForHref("/about/")).toBe("/about/");
		expect(safeUrlForHref("#top")).toBe("#top");
		expect(safeUrlForHref("?page=2")).toBe("?page=2");
		expect(safeUrlForHref(" https://example.com/a ")).toBe(
			"https://example.com/a",
		);
	});

	test("rejects unsafe link protocols and control characters", () => {
		expect(safeUrlForHref("javascript:alert(1)")).toBe("");
		expect(safeUrlForHref("data:text/html,<script>alert(1)</script>")).toBe("");
		expect(safeUrlForHref("vbscript:msgbox(1)")).toBe("");
		expect(safeUrlForHref("//example.com/path")).toBe("");
		expect(safeUrlForHref("https://example.com/\u0000path")).toBe("");
	});

	test("allows only same-origin paths and http URLs for media sources", () => {
		expect(safeUrlForMediaSrc("/wp-content/uploads/photo.jpg")).toBe(
			"/wp-content/uploads/photo.jpg",
		);
		expect(safeUrlForMediaSrc("https://media.example/photo.jpg")).toBe(
			"https://media.example/photo.jpg",
		);
		expect(safeUrlForMediaSrc("#photo")).toBe("");
		expect(safeUrlForMediaSrc("?photo=1")).toBe("");
		expect(safeUrlForMediaSrc("javascript:alert(1)")).toBe("");
	});

	test("allows only trusted https iframe hosts", () => {
		expect(
			safeUrlForIframeSrc("https://www.youtube.com/embed/dQw4w9WgXcQ"),
		).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
		expect(safeUrlForIframeSrc("https://player.vimeo.com/video/123")).toBe(
			"https://player.vimeo.com/video/123",
		);
		expect(safeUrlForIframeSrc("https://animoto.com/play/abc")).toBe(
			"https://animoto.com/play/abc",
		);
		expect(safeUrlForIframeSrc("http://www.youtube.com/embed/id")).toBe("");
		expect(safeUrlForIframeSrc("https://example.com/embed/id")).toBe("");
		expect(safeUrlForIframeSrc("javascript:alert(1)")).toBe("");
	});
});
