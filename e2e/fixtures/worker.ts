import { test as base, expect, type APIRequestContext } from "@playwright/test";

import {
	completeSetup,
	startWorkerServer,
	TEST_AUTH_HEADER,
	type WorkerServer,
} from "../support/worker-server";

interface TestFixtures {
	authedRequest: APIRequestContext;
}

interface WorkerFixtures {
	workerServer: WorkerServer;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
	workerServer: [
		async ({}, use, workerInfo) => {
			const server = await startWorkerServer(workerInfo.workerIndex);

			try {
				await completeSetup(server.baseURL);
				await use(server);
				server.assertNoErrors();
			} finally {
				await server.stop();
			}
		},
		{ scope: "worker", timeout: 120_000 },
	],

	baseURL: async ({ workerServer }, use) => {
		await use(workerServer.baseURL);
	},

	page: async ({ page }, use) => {
		await page.setExtraHTTPHeaders({
			[TEST_AUTH_HEADER]: "1",
		});
		await use(page);
	},

	authedRequest: async ({ playwright, workerServer }, use) => {
		const request = await playwright.request.newContext({
			baseURL: workerServer.baseURL,
			extraHTTPHeaders: {
				[TEST_AUTH_HEADER]: "1",
				"X-EmDash-Request": "1",
			},
		});

		try {
			await use(request);
		} finally {
			await request.dispose();
		}
	},
});

export { expect, TEST_AUTH_HEADER };
