import { getRuntimeSiteSettings } from "../lib/content";
import { rewriteInternalMediaFileUrl } from "../lib/media";
import { SITE_TAGLINE_FALLBACK, SITE_TITLE_FALLBACK } from "../lib/site-config";

export async function GET() {
	const settings = await getRuntimeSiteSettings();
	const siteTitle = settings?.title || SITE_TITLE_FALLBACK;
	const favicon = settings?.favicon;
	const faviconIcon = favicon?.url
		? {
				src: rewriteInternalMediaFileUrl(favicon.url),
				sizes:
					favicon.width && favicon.height
						? `${favicon.width}x${favicon.height}`
						: "any",
				...(favicon.contentType ? { type: favicon.contentType } : {}),
			}
		: {
				src: "/favicon.svg",
				sizes: "any",
				type: "image/svg+xml",
			};

	return new Response(
		JSON.stringify(
			{
				name: siteTitle,
				short_name:
					siteTitle === SITE_TITLE_FALLBACK ? "EngagedPhil" : siteTitle,
				description: settings?.tagline || SITE_TAGLINE_FALLBACK,
				icons: [faviconIcon],
				theme_color: "#fd7e14",
				background_color: "#ffffff",
				display: "standalone",
			},
			null,
			"\t",
		),
		{
			headers: {
				"Content-Type": "application/manifest+json; charset=utf-8",
			},
		},
	);
}
