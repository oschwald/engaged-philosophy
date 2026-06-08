import { getRuntimeSiteSettings } from "../lib/content";
import { createFaviconResponse } from "../lib/favicon";

export async function GET() {
	return createFaviconResponse(await getRuntimeSiteSettings());
}
