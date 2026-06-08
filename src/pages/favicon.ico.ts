import { getRuntimeSiteSettings } from "../lib/content";
import { createFaviconResponse } from "../lib/favicon";

export async function GET({ request }: { request: Request }) {
	return createFaviconResponse(await getRuntimeSiteSettings(), {
		requestUrl: request.url,
	});
}
