import { test, expect } from "@playwright/test";

import {
	completeSetup,
	jsonRequest,
	startWorkerServer,
} from "../../support/worker-server";

// The preview flag uses local bindings only. This test never opens a deployed URL.
test("serves preview uploads from local MEDIA and keeps the production canonical", async ({}, testInfo) => {
	test.setTimeout(120_000);
	const server = await startWorkerServer(9100 + testInfo.workerIndex, {
		preview: true,
	});
	try {
		await completeSetup(server.baseURL);
		const bytes = Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU1sAAAAASUVORK5CYII=",
			"base64",
		);
		const form = new FormData();
		form.set("file", new Blob([bytes], { type: "image/png" }), "preview.png");
		const upload = (await jsonRequest(server.baseURL, "/_emdash/api/media", {
			method: "POST",
			body: form,
		})) as { data: { item: { url: string; id: string } } };
		const url = upload.data.item.url;
		expect(url).toMatch(/^\/_emdash\/api\/media\/file\//);
		const image = await fetch(`${server.baseURL}${url}`);
		expect(image.status).toBe(200);
		expect(Buffer.from(await image.arrayBuffer())).toEqual(bytes);
		await jsonRequest(server.baseURL, "/_emdash/api/settings", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ favicon: { mediaId: upload.data.item.id } }),
		});
		const favicon = await fetch(`${server.baseURL}/favicon.ico`, {
			redirect: "manual",
		});
		expect(favicon.status).toBe(302);
		expect(favicon.headers.get("location")).toBe(url);
		const home = await (await fetch(server.baseURL)).text();
		expect(home).toContain('href="https://www.engagedphilosophy.com/"');
		server.assertNoErrors();
	} finally {
		await server.stop();
	}
});
