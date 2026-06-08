import { createFaviconResponse } from "../lib/favicon";
import { getRuntimeSiteSettings } from "../lib/content";

export async function GET() {
	return createFaviconResponse(await getRuntimeSiteSettings());
}
