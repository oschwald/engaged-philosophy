import { describe, expect, test } from "vitest";

import { formatPublicationDate } from "../../src/lib/publication-date";

describe("publication date formatting", () => {
	test("uses the site's Pacific timezone across a UTC date boundary", () => {
		expect(
			formatPublicationDate(new Date("2016-08-24T00:37:36Z"), {
				timezone: "America/Los_Angeles",
				dateFormat: "MMMM d, yyyy",
			}),
		).toBe("August 23, 2016");
	});

	test("honors native EmDash date presentation settings", () => {
		expect(
			formatPublicationDate("2016-08-24T00:37:36Z", {
				timezone: "UTC",
				dateFormat: "yyyy-MM-dd",
			}),
		).toBe("2016-08-24");
	});

	test("falls back safely for invalid settings", () => {
		expect(
			formatPublicationDate("2016-08-24T00:37:36Z", {
				timezone: "Not/A_Timezone",
				dateFormat: "not a format",
			}),
		).toBe("August 23, 2016");
	});

	test("omits missing and invalid dates", () => {
		expect(formatPublicationDate(null)).toBe("");
		expect(formatPublicationDate("not a date")).toBe("");
	});
});
