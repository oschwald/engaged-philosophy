import auditLogDefinition from "@emdash-cms/plugin-audit-log/sandbox";
import type {
	PluginContext,
	RouteEntry,
	RouteHandler,
	SandboxedRouteContext,
} from "emdash/plugin";

interface NativeRouteContext extends PluginContext {
	input: unknown;
	request: Request;
	requestMeta?: unknown;
}

interface NativeRoute {
	public?: boolean;
	input?: unknown;
	handler: (ctx: NativeRouteContext) => Promise<unknown>;
}

function routeConfig(route: RouteEntry) {
	return typeof route === "function" ? { handler: route } : route;
}

function serializeHeaders(headers: Headers) {
	const result: Record<string, string> = {};
	headers.forEach((value, name) => {
		result[name] = value;
	});
	return result;
}

function sandboxRouteContext(ctx: NativeRouteContext): SandboxedRouteContext {
	return {
		input: ctx.input,
		request: {
			url: ctx.request.url,
			method: ctx.request.method,
			headers: serializeHeaders(ctx.request.headers),
		},
		requestMeta: ctx.requestMeta,
	};
}

function createNativeRoute(route: RouteEntry): NativeRoute {
	const config = routeConfig(route);
	const handler = config.handler as RouteHandler;

	return {
		public: config.public,
		input: config.input,
		handler: (ctx) => handler(sandboxRouteContext(ctx), ctx),
	};
}

function createRoutes() {
	const routes: Record<string, NativeRoute> = {};
	for (const [name, route] of Object.entries(auditLogDefinition.routes ?? {})) {
		routes[name] = createNativeRoute(route);
	}
	return routes;
}

export function createPlugin() {
	return {
		id: "audit-log",
		version: "0.2.0",
		capabilities: ["content:read"],
		allowedHosts: [],
		storage: {
			entries: {
				indexes: ["timestamp", "action", "resourceType", "collection"],
			},
		},
		hooks: auditLogDefinition.hooks ?? {},
		routes: createRoutes(),
		admin: {
			pages: [{ path: "/history", label: "Audit History", icon: "history" }],
			widgets: [
				{ id: "recent-activity", title: "Recent Activity", size: "half" },
			],
		},
	};
}
