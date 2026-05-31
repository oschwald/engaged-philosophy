import { getRuntimeSiteSettings } from "../lib/content";
import { rewriteInternalMediaFileUrl } from "../lib/media";

export async function GET() {
	const settings = await getRuntimeSiteSettings();
	const siteTitle = settings?.title || "Engaged Philosophy";
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
					siteTitle === "Engaged Philosophy" ? "EngagedPhil" : siteTitle,
				description:
					settings?.tagline || "Civic Engagement in Philosophy Classes",
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
