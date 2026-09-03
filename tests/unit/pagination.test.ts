import { describe, expect, test } from "vitest";

import { MAX_ARCHIVE_PAGE, parseArchivePage } from "../../src/lib/pagination";

describe("archive pagination", () => {
	test("accepts realistic positive page numbers", () => {
		expect(parseArchivePage("1")).toBe(1);
		expect(parseArchivePage(String(MAX_ARCHIVE_PAGE))).toBe(MAX_ARCHIVE_PAGE);
	});

	test.each(["0", "-1", "1.5", "01", "not-a-page", "101"])(
		"rejects an invalid or excessive page number: %s",
		(value) => {
			expect(parseArchivePage(value)).toBeNull();
		},
	);
});
