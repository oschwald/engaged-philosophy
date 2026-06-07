import auditLogDefinition from "@emdash-cms/plugin-audit-log/sandbox";
import type {
	PluginContext,
	RouteEntry,
	RouteHandler,
	SandboxedRouteContext,
} from "emdash/plugin";

type AnyHookHandler = (...args: unknown[]) => unknown;
type AnyHookEntry =
	| AnyHookHandler
	| {
			handler: AnyHookHandler;
			priority?: number;
			timeout?: number;
			dependencies?: string[];
			errorPolicy?: "continue" | "abort";
			exclusive?: boolean;
	  };

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

function isHookConfig(
	entry: AnyHookEntry,
): entry is Exclude<AnyHookEntry, AnyHookHandler> {
	return typeof entry === "object" && entry !== null && "handler" in entry;
}

function createNativeHook(entry: AnyHookEntry) {
	if (isHookConfig(entry)) {
		return {
			priority: entry.priority ?? 100,
			timeout: entry.timeout ?? 5000,
			dependencies: entry.dependencies ?? [],
			errorPolicy: entry.errorPolicy ?? "abort",
			exclusive: entry.exclusive ?? false,
			handler: entry.handler,
			pluginId: "audit-log",
		};
	}

	return {
		priority: 100,
		timeout: 5000,
		dependencies: [],
		errorPolicy: "abort" as const,
		exclusive: false,
		handler: entry,
		pluginId: "audit-log",
	};
}

function createNativeHooks() {
	const hooks: Record<string, ReturnType<typeof createNativeHook>> = {};
	const hookMap = (auditLogDefinition.hooks ?? {}) as Record<
		string,
		AnyHookEntry
	>;

	for (const [name, entry] of Object.entries(hookMap)) {
		hooks[name] = createNativeHook(entry);
	}

	return hooks;
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
		capabilities: ["content:read", "content:write", "media:read"],
		allowedHosts: [],
		storage: {
			entries: {
				indexes: ["timestamp", "action", "resourceType", "collection"],
			},
		},
		hooks: createNativeHooks(),
		routes: createRoutes(),
		admin: {
			pages: [{ path: "/history", label: "Audit History", icon: "history" }],
			widgets: [
				{ id: "recent-activity", title: "Recent Activity", size: "half" },
			],
		},
	};
}
