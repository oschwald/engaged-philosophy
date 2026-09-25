import type {
	FixtureEvent,
	StaticServerFixture,
} from "../fixtures/static-server";
import { test, expect } from "../fixtures/static-server";

function eventTypes(events: FixtureEvent[]) {
	return events.map((event) => event.type);
}

async function waitForFixtureEvent(
	staticServer: StaticServerFixture,
	predicate: (events: FixtureEvent[]) => boolean,
	timeout = 5000,
) {
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeout) {
		const events = staticServer.getEvents();
		if (predicate(events)) return events;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}

	throw new Error(
		`Timed out waiting for fixture events. Last events: ${eventTypes(
			staticServer.getEvents(),
		).join(" -> ")}`,
	);
}

function expectEventOrder(events: FixtureEvent[], expectedOrder: string[]) {
	const positions = expectedOrder.map((type) =>
		events.findIndex((event) => event.type === type),
	);

	for (const [index, position] of positions.entries()) {
		expect(
			position,
			`Missing fixture event: ${expectedOrder[index]}`,
		).toBeGreaterThanOrEqual(0);

		if (index > 0) {
			expect(
				position,
				`Expected event order ${expectedOrder.join(" -> ")}, got ${eventTypes(
					events,
				).join(" -> ")}`,
			).toBeGreaterThan(positions[index - 1]);
		}
	}
}

test.describe("custom EmDash save gate", () => {
	test("does not force a save when disabling edit mode without edits", async ({
		page,
		staticServer,
	}) => {
		staticServer.resetEvents();
		await page.goto("/emdash-save-gate/", { waitUntil: "domcontentloaded" });

		await page.locator("#emdash-edit-toggle").click();
		const events = await waitForFixtureEvent(
			staticServer,
			(nextEvents) =>
				nextEvents.filter((event) => event.type === "page").length >= 2,
		);

		expect(eventTypes(events)).not.toContain("save-start");
	});

	test("waits for an active inline save before publishing", async ({
		page,
		staticServer,
	}) => {
		staticServer.resetEvents();
		await page.goto("/emdash-save-gate/", { waitUntil: "domcontentloaded" });

		await page.locator("#editor").click();
		await page.keyboard.type(" changed");
		await page.locator("#emdash-tb-publish").click();

		const events = await waitForFixtureEvent(staticServer, (nextEvents) =>
			nextEvents.some((event) => event.type === "publish-start"),
		);
		expectEventOrder(events, ["save-start", "save-finish", "publish-start"]);
		expect(
			await page.evaluate(() =>
				Reflect.get(window, "__originalPublishHandlerRan"),
			),
		).toBe(true);
	});

	test("shows a publish network failure after a successful save and allows retry", async ({
		page,
		staticServer,
	}) => {
		staticServer.resetEvents();
		await page.goto("/emdash-save-gate/", { waitUntil: "domcontentloaded" });
		const publishUrl =
			"**/_emdash/api/visual-editing/content/pages/about/publish";
		await page.route(publishUrl, (route) => route.abort("failed"));
		await page.evaluate(() => {
			document.addEventListener("emdash:save", (event) => {
				document.documentElement.dataset.saveState = (
					event as CustomEvent<{ state: string }>
				).detail.state;
			});
		});
		await page.locator("#editor").fill("Changed content to publish");
		await page.locator("#emdash-tb-publish").click();
		await expect(page.locator("html")).toHaveAttribute(
			"data-save-state",
			"error",
		);
		expectEventOrder(staticServer.getEvents(), ["save-start", "save-finish"]);
		expect(eventTypes(staticServer.getEvents())).not.toContain("publish-start");

		await page.unroute(publishUrl);
		await page.locator("#emdash-tb-publish").click();
		await waitForFixtureEvent(staticServer, (events) =>
			eventTypes(events).includes("publish-start"),
		);
	});

	test("forwards unload saves even without an unsaved-state event", async ({
		page,
		staticServer,
	}) => {
		staticServer.resetEvents();
		await page.goto("/emdash-save-gate/", { waitUntil: "domcontentloaded" });
		const status = await page.evaluate(async () => {
			const response = await fetch("/_emdash/api/content/pages/about", {
				method: "PUT",
				keepalive: true,
			});
			return response.status;
		});
		expect(status).toBe(200);
		expectEventOrder(staticServer.getEvents(), ["save-start", "save-finish"]);
	});

	for (const action of ["publish", "leave edit mode"] as const) {
		test(`stops ${action} when the inline save is refused by an entry lock`, async ({
			page,
			staticServer,
		}) => {
			staticServer.resetEvents();
			await page.goto("/emdash-save-gate/", { waitUntil: "domcontentloaded" });
			await page.route("**/_emdash/api/content/pages/about", (route) =>
				route.fulfill({
					status: 409,
					json: { success: false, error: { code: "ENTRY_LOCKED" } },
				}),
			);
			await page.evaluate(() => {
				document.addEventListener("emdash:save", (event) => {
					document.documentElement.dataset.saveState = (
						event as CustomEvent<{ state: string }>
					).detail.state;
				});
			});
			await page.locator("#editor").click();
			await page.keyboard.type(" changed");
			const control = page.locator(
				action === "publish" ? "#emdash-tb-publish" : "#emdash-edit-toggle",
			);
			await control.click();
			await expect(page.locator("html")).toHaveAttribute(
				"data-save-state",
				"error",
			);
			await expect(control).toBeEnabled();
			await expect(page.locator("#emdash-edit-toggle")).toBeChecked();
			expect(eventTypes(staticServer.getEvents())).toEqual(["page"]);
		});

		test(`requires a successful retry before ${action} after a completed save failure`, async ({
			page,
			staticServer,
		}) => {
			staticServer.resetEvents();
			await page.goto("/emdash-save-gate/", { waitUntil: "domcontentloaded" });
			let locked = true;
			await page.route("**/_emdash/api/content/pages/about", (route) =>
				route.fulfill({
					status: locked ? 409 : 200,
					json: { success: !locked },
				}),
			);
			const editor = page.locator("#editor");
			await editor.fill("An edit that will fail");
			const failure = page.waitForResponse(
				(response) => response.status() === 409,
			);
			await editor.evaluate((element) => element.blur());
			await failure;
			await page.evaluate(() => {
				document.addEventListener("emdash:save", (event) => {
					document.documentElement.dataset.saveState = (
						event as CustomEvent<{ state: string }>
					).detail.state;
				});
			});

			const control = page.locator(
				action === "publish" ? "#emdash-tb-publish" : "#emdash-edit-toggle",
			);
			await control.click();
			await expect(page.locator("html")).toHaveAttribute(
				"data-save-state",
				"error",
			);
			await expect(control).toBeEnabled();
			expect(eventTypes(staticServer.getEvents())).toEqual(["page"]);

			// Undo to the stored document starts no request. Without an upstream
			// clean-state acknowledgment, the gate retains the previous failure.
			await editor.fill("Original content");
			await control.click();
			await expect(page.locator("html")).toHaveAttribute(
				"data-save-state",
				"error",
			);
			await expect(control).toBeEnabled();
			expect(eventTypes(staticServer.getEvents())).toEqual(["page"]);

			locked = false;
			await editor.fill("A successful retry");
			await control.click();
			await waitForFixtureEvent(staticServer, (events) =>
				action === "publish"
					? eventTypes(events).includes("publish-start")
					: events.filter((event) => event.type === "page").length === 2,
			);
		});
	}

	test("waits for an active inline save before leaving edit mode", async ({
		page,
		staticServer,
	}) => {
		staticServer.resetEvents();
		await page.goto("/emdash-save-gate/", { waitUntil: "domcontentloaded" });

		await page.locator("#editor").click();
		await page.keyboard.type(" changed");
		await page.locator("#emdash-edit-toggle").click();

		const events = await waitForFixtureEvent(
			staticServer,
			(nextEvents) =>
				nextEvents.filter((event) => event.type === "page").length >= 2,
		);
		expectEventOrder(events, ["save-start", "save-finish"]);

		const secondPagePosition = events.findIndex(
			(event, index) => event.type === "page" && index > 0,
		);
		const saveFinishPosition = events.findIndex(
			(event) => event.type === "save-finish",
		);

		expect(saveFinishPosition).toBeLessThan(secondPagePosition);
	});

	test("does not block on stale unsaved state from unchanged content", async ({
		page,
		staticServer,
	}) => {
		staticServer.resetEvents();
		await page.goto("/emdash-save-gate-stale-unsaved/", {
			waitUntil: "domcontentloaded",
		});

		await page.locator("#emdash-edit-toggle").click();
		const events = await waitForFixtureEvent(
			staticServer,
			(nextEvents) =>
				nextEvents.filter((event) => event.type === "page").length >= 2,
		);

		expect(eventTypes(events)).not.toContain("save-start");
	});

	test("does not install outside active edit mode", async ({ page }) => {
		await page.goto("/emdash-save-gate-inactive/", {
			waitUntil: "domcontentloaded",
		});

		const installed = await page.evaluate(
			() =>
				(
					window as Window & {
						__engagedPhilosophySaveGateInstalled?: boolean;
					}
				).__engagedPhilosophySaveGateInstalled === true,
		);

		expect(installed).toBe(false);
	});
});
