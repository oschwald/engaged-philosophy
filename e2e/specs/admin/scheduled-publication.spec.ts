import { test, expect } from "../../fixtures/worker";
import {
	createContentViaApi,
	deleteContentViaApi,
	expectPublicContent,
	publicPathForItem,
	uniqueTitle,
} from "../../support/content";

test("publishes due content through the built Worker's scheduled handler", async ({
	authedRequest,
	publicPage,
}, testInfo) => {
	const title = uniqueTitle("E2E Scheduled Project", testInfo.testId);
	const bodyText = `${title} published by scheduled maintenance.`;
	const created = await createContentViaApi(authedRequest, "projects", {
		title,
		content: bodyText,
	});
	const apiPath = `/_emdash/api/content/projects/${created.id}`;
	const publicPath = publicPathForItem("projects", created);

	try {
		const scheduled = await authedRequest.post(`${apiPath}/schedule`, {
			data: { scheduledAt: new Date(Date.now() + 5_000).toISOString() },
		});
		expect(scheduled.ok(), await scheduled.text()).toBe(true);
		expect((await publicPage.request.get(publicPath)).status()).toBe(404);

		await expect
			.poll(
				async () => {
					const tick = await authedRequest.get("/cdn-cgi/local/scheduled", {
						params: { cron: "*/5 * * * *", format: "json" },
					});
					expect(tick.ok(), await tick.text()).toBe(true);
					const response = await authedRequest.get(apiPath);
					expect(response.ok(), await response.text()).toBe(true);
					const body = await response.json();
					return body.data.item.status;
				},
				{ timeout: 15_000, intervals: [1_000] },
			)
			.toBe("published");
		await expectPublicContent(publicPage, publicPath, title, bodyText);
	} finally {
		await deleteContentViaApi(authedRequest, "projects", created.id);
	}
});
