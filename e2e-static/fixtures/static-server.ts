import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { test as base, expect } from "@playwright/test";

const SAVE_GATE_SCRIPT = readFileSync(
	new URL("../../src/js/emdash-save-gate.js", import.meta.url),
	"utf8",
);

type FixtureEventType = "page" | "save-start" | "save-finish" | "publish-start";

export interface FixtureEvent {
	type: FixtureEventType;
	time: number;
}

export interface StaticServerFixture {
	baseURL: string;
	getEvents: () => FixtureEvent[];
	resetEvents: () => void;
}

interface StaticWorkerFixtures {
	staticServer: StaticServerFixture;
}

function normalizePath(pathname: string) {
	const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
	return normalized === "/" || normalized.endsWith("/")
		? normalized
		: `${normalized}/`;
}

function sendHtml(response: ServerResponse, html: string) {
	response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
	response.end(html);
}

function sendNotFound(response: ServerResponse) {
	response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
	response.end("Not found");
}

function consumeRequest(request: IncomingMessage, callback: () => void) {
	request.on("end", callback);
	request.resume();
}

function saveGateFixtureShell() {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Save Gate - Engaged Philosophy</title>
	</head>
	<body>
		<div id="emdash-toolbar" data-edit-mode="true">
			<input type="checkbox" id="emdash-edit-toggle" checked />
			<span id="emdash-tb-status"></span>
			<span id="emdash-tb-save-status"></span>
			<button id="emdash-tb-publish" type="button">Publish</button>
		</div>
		<main>
			<article data-emdash-ref='{"collection":"pages","id":"about","status":"published","hasDraft":true}'>
				<div id="editor" class="emdash-inline-editor" contenteditable="true">Original content</div>
			</article>
		</main>
		<script>${SAVE_GATE_SCRIPT}</script>
		<script>
			const editor = document.getElementById("editor");
			let originalValue = editor.textContent;

			editor.addEventListener("input", () => {
				document.dispatchEvent(new CustomEvent("emdash:save", { detail: { state: "unsaved" } }));
			});

			editor.addEventListener("blur", () => {
				if (editor.textContent === originalValue) return;
				fetch("/_emdash/api/content/pages/about", {
					method: "PUT",
					credentials: "same-origin",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ data: { content: editor.textContent } }),
				}).then((response) => {
					if (response.ok) {
						originalValue = editor.textContent;
						document.dispatchEvent(new CustomEvent("emdash:save", { detail: { state: "saved" } }));
					} else {
						document.dispatchEvent(new CustomEvent("emdash:save", { detail: { state: "error" } }));
					}
				}).catch(() => {
					document.dispatchEvent(new CustomEvent("emdash:save", { detail: { state: "error" } }));
				});
			});

			document.getElementById("emdash-tb-publish").onclick = () => {
				window.__originalPublishHandlerRan = true;
				fetch("/_emdash/api/content/pages/about/publish", {
					method: "POST",
					credentials: "same-origin",
					headers: { "X-EmDash-Request": "1" },
				});
			};

			document.getElementById("emdash-edit-toggle").addEventListener("change", () => {
				window.__originalToggleHandlerRan = true;
				location.replace(location.href);
			});
		</script>
	</body>
</html>`;
}

function inactiveSaveGateFixtureShell() {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Inactive Save Gate - Engaged Philosophy</title>
	</head>
	<body>
		<div id="emdash-toolbar" data-edit-mode="false">
			<input type="checkbox" id="emdash-edit-toggle" />
			<span id="emdash-tb-status"></span>
			<span id="emdash-tb-save-status"></span>
			<button id="emdash-tb-publish" type="button">Publish</button>
		</div>
		<main>
			<article data-emdash-ref='{"collection":"pages","id":"about","status":"published","hasDraft":false}'>
				<p>View mode content.</p>
			</article>
		</main>
		<script>${SAVE_GATE_SCRIPT}</script>
	</body>
</html>`;
}

function staleUnsavedSaveGateFixtureShell() {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Stale Unsaved Save Gate - Engaged Philosophy</title>
	</head>
	<body>
		<div id="emdash-toolbar" data-edit-mode="true">
			<input type="checkbox" id="emdash-edit-toggle" checked />
			<span id="emdash-tb-status"></span>
			<span id="emdash-tb-save-status"></span>
			<button id="emdash-tb-publish" type="button">Publish</button>
		</div>
		<main>
			<article data-emdash-ref='{"collection":"pages","id":"about","status":"published","hasDraft":false}'>
				<div id="editor" class="emdash-inline-editor" contenteditable="true">Unchanged content</div>
			</article>
		</main>
		<script>${SAVE_GATE_SCRIPT}</script>
		<script>
			document.addEventListener("DOMContentLoaded", () => {
				document.dispatchEvent(new CustomEvent("emdash:save", { detail: { state: "unsaved" } }));
			});
		</script>
	</body>
</html>`;
}

async function createStaticServer() {
	const events: FixtureEvent[] = [];

	const server = createServer(
		(request: IncomingMessage, response: ServerResponse) => {
			const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
			const pathname = normalizePath(requestUrl.pathname);

			if (pathname === "/emdash-save-gate/") {
				events.push({ type: "page", time: Date.now() });
				sendHtml(response, saveGateFixtureShell());
				return;
			}

			if (pathname === "/emdash-save-gate-inactive/") {
				sendHtml(response, inactiveSaveGateFixtureShell());
				return;
			}

			if (pathname === "/emdash-save-gate-stale-unsaved/") {
				events.push({ type: "page", time: Date.now() });
				sendHtml(response, staleUnsavedSaveGateFixtureShell());
				return;
			}

			if (
				request.method === "PUT" &&
				requestUrl.pathname === "/_emdash/api/content/pages/about"
			) {
				events.push({ type: "save-start", time: Date.now() });
				consumeRequest(request, () => {
					setTimeout(() => {
						events.push({ type: "save-finish", time: Date.now() });
						response.writeHead(200, {
							"content-type": "application/json; charset=utf-8",
						});
						response.end(JSON.stringify({ success: true }));
					}, 400);
				});
				return;
			}

			if (
				request.method === "POST" &&
				requestUrl.pathname === "/_emdash/api/content/pages/about/publish"
			) {
				events.push({ type: "publish-start", time: Date.now() });
				consumeRequest(request, () => {
					response.writeHead(200, {
						"content-type": "application/json; charset=utf-8",
					});
					response.end(JSON.stringify({ success: true }));
				});
				return;
			}

			sendNotFound(response);
		},
	);

	await new Promise<void>((resolve) => {
		server.listen(0, "127.0.0.1", resolve);
	});

	const address = server.address() as AddressInfo;

	return {
		baseURL: `http://127.0.0.1:${address.port}`,
		getEvents: () => [...events],
		resetEvents: () => {
			events.length = 0;
		},
		stop: () =>
			new Promise<void>((resolve, reject) => {
				server.close((error?: Error) => {
					if (error) {
						reject(error);
					} else {
						resolve();
					}
				});
			}),
	};
}

export const test = base.extend<object, StaticWorkerFixtures>({
	staticServer: [
		async ({}, use) => {
			const server = await createStaticServer();

			try {
				await use(server);
			} finally {
				await server.stop();
			}
		},
		{ scope: "worker" },
	],

	baseURL: async ({ staticServer }, use) => {
		await use(staticServer.baseURL);
	},
});

export { expect };
