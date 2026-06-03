import handler from "@astrojs/cloudflare/entrypoints/server";

import {
	getObservedRequestInfo,
	OBSERVED_REQUEST_SLOW_MS,
} from "./lib/admin-request-observability";

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
		epCache: response.headers.get("X-EP-Cache"),
		cfCacheStatus: response.headers.get("CF-Cache-Status"),
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
	async fetch(request, env, ctx) {
		const info = getObservedRequestInfo(request);
		if (!info) {
			return astroHandler.fetch(request, env, ctx);
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
			const response = await astroHandler.fetch(request, env, ctx);
			completed = true;
			console.log(responseLog(info, startedAt, response));

			const observedResponse = new Response(response.body, response);
			observedResponse.headers.set("X-EP-Request-ID", info.requestId);
			return observedResponse;
		} catch (error) {
			completed = true;
			console.error(errorLog(info, startedAt, error));
			throw error;
		}
	},
};

export default observedHandler;
