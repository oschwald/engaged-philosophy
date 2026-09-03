const BLOCKED_CRAWLERS = ["MJ12bot", "VelenPublicWebCrawler"] as const;

export function getBlockedCrawler(request: Request): string | null {
	const userAgent = request.headers.get("user-agent")?.toLowerCase() ?? "";
	return (
		BLOCKED_CRAWLERS.find((crawler) =>
			userAgent.includes(crawler.toLowerCase()),
		) ?? null
	);
}

export function createBlockedCrawlerResponse(
	request: Request,
	crawler: string,
) {
	return new Response(
		request.method === "HEAD" ? null : "Crawler access denied.\n",
		{
			status: 403,
			headers: {
				"Cache-Control": "private, no-store",
				"Content-Type": "text/plain; charset=utf-8",
				"X-Blocked-Crawler": crawler,
				"X-Robots-Tag": "noindex, nofollow",
			},
		},
	);
}
