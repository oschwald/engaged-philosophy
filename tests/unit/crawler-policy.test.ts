import { describe, expect, test } from "vitest";

import {
	createBlockedCrawlerResponse,
	getBlockedCrawler,
} from "../../src/lib/crawler-policy";

describe("crawler policy", () => {
	test.each(["MJ12bot/v1.4.8", "Mozilla/5.0 VelenPublicWebCrawler/1.0"])(
		"blocks an observed high-volume crawler before rendering: %s",
		(userAgent) => {
			const request = new Request(
				"https://www.engagedphilosophy.com/topic/art/",
				{
					headers: { "user-agent": userAgent },
				},
			);

			const crawler = getBlockedCrawler(request);
			expect(crawler).not.toBeNull();

			const response = createBlockedCrawlerResponse(request, crawler!);
			expect(response.status).toBe(403);
			expect(response.headers.get("cache-control")).toBe("private, no-store");
			expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
		},
	);

	test("allows ordinary browsers and mainstream search crawlers", () => {
		for (const userAgent of [
			"Mozilla/5.0 AppleWebKit/537.36 Chrome/148.0 Safari/537.36",
			"Mozilla/5.0 (compatible; bingbot/2.0)",
		]) {
			const request = new Request("https://www.engagedphilosophy.com/", {
				headers: { "user-agent": userAgent },
			});
			expect(getBlockedCrawler(request)).toBeNull();
		}
	});

	test("does not attach a response body to HEAD requests", async () => {
		const request = new Request("https://www.engagedphilosophy.com/", {
			method: "HEAD",
		});
		const response = createBlockedCrawlerResponse(request, "MJ12bot");

		await expect(response.text()).resolves.toBe("");
	});
});
