import handler from "@astrojs/cloudflare/entrypoints/server";
import {
	createScheduledHandler,
	PluginBridge,
} from "@emdash-cms/cloudflare/worker";

import {
	getObservedRequestInfo,
	OBSERVED_REQUEST_SLOW_MS,
} from "./lib/admin-request-observability";
import {
	createBlockedCrawlerResponse,
	getBlockedCrawler,
} from "./lib/crawler-policy";
import { applyPublicRequestPolicy } from "./lib/public-request-policy";
import { applySecurityHeaders } from "./lib/security-headers";

type Env = Record<string, unknown>;
type AstroHandler = Required<Pick<ExportedHandler<Env>, "fetch">>;

const astroHandler = handler as AstroHandler;

function elapsedSince(startedAt: number) {
	return Math.round(performance.now() - startedAt);
}

function requestLog(
	event: "ep.request.start" | "ep.request.slow",
	info: NonNullable<ReturnType<typeof getObservedRequestInfo>>,
	startedAt: number,
) {
	return {
		event,
		requestId: info.requestId,
		method: info.method,
		path: info.path,
		queryKeys: info.queryKeys,
		reasons: info.reasons,
		cookieFlags: info.cookieFlags,
		...(event === "ep.request.slow"
			? { elapsedMs: elapsedSince(startedAt) }
			: {}),
	};
}

function responseLog(
	info: NonNullable<ReturnType<typeof getObservedRequestInfo>>,
	startedAt: number,
	response: Response,
) {
	return {
		event: "ep.request.complete",
		requestId: info.requestId,
		method: info.method,
		path: info.path,
		status: response.status,
		elapsedMs: elapsedSince(startedAt),
		serverTiming: response.headers.get("Server-Timing"),
	};
}

function errorLog(
	info: NonNullable<ReturnType<typeof getObservedRequestInfo>>,
	startedAt: number,
	error: unknown,
) {
	return {
		event: "ep.request.error",
		requestId: info.requestId,
		method: info.method,
		path: info.path,
		elapsedMs: elapsedSince(startedAt),
		errorName: error instanceof Error ? error.name : typeof error,
		errorMessage: error instanceof Error ? error.message : String(error),
	};
}

const observedHandler: ExportedHandler<Env> = {
	scheduled: createScheduledHandler(),

	async fetch(request, env, ctx) {
		const securityOptions = {
			statefulCookieBypassActive:
				env.CACHE_STATEFUL_COOKIE_BYPASS_ACTIVE === "true",
		};
		const policy = applyPublicRequestPolicy(request);
		if (policy.response) {
			return applySecurityHeaders(request, policy.response, securityOptions);
		}
		// Cloning a Request with a new URL preserves Cloudflare's incoming `cf`
		// metadata even though the platform's constructor typing widens it.
		const routedRequest = policy.request as typeof request;

		const blockedCrawler = getBlockedCrawler(routedRequest);
		if (blockedCrawler) {
			return applySecurityHeaders(
				routedRequest,
				createBlockedCrawlerResponse(routedRequest, blockedCrawler),
				securityOptions,
			);
		}

		const info = getObservedRequestInfo(routedRequest);
		if (!info) {
			const response = await astroHandler.fetch(routedRequest, env, ctx);
			return applySecurityHeaders(routedRequest, response, securityOptions);
		}

		const startedAt = performance.now();
		let completed = false;

		ctx.waitUntil(
			new Promise<void>((resolve) => {
				setTimeout(() => {
					if (!completed) {
						console.warn(requestLog("ep.request.slow", info, startedAt));
					}
					resolve();
				}, OBSERVED_REQUEST_SLOW_MS);
			}),
		);

		console.log(requestLog("ep.request.start", info, startedAt));

		try {
			const response = await astroHandler.fetch(routedRequest, env, ctx);
			completed = true;
			console.log(responseLog(info, startedAt, response));

			const observedResponse = applySecurityHeaders(
				routedRequest,
				response,
				securityOptions,
			);
			observedResponse.headers.set("X-EP-Request-ID", info.requestId);
			return observedResponse;
		} catch (error) {
			completed = true;
			console.error(errorLog(info, startedAt, error));
			throw error;
		}
	},
};

export { PluginBridge };
export default observedHandler;
