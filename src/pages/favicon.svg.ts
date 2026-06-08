import { createFaviconResponse } from "../lib/favicon";
import { getRuntimeSiteSettings } from "../lib/content";

export async function GET({ request }: { request: Request }) {
	return createFaviconResponse(await getRuntimeSiteSettings(), {
		requestUrl: request.url,
	});
}
