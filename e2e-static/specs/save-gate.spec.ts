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

	test("suppresses only redundant unload saves", async ({
		page,
		staticServer,
	}) => {
		staticServer.resetEvents();
		await page.goto("/emdash-save-gate/", { waitUntil: "domcontentloaded" });

		const unchangedStatus = await page.evaluate(async () => {
			const response = await fetch("/_emdash/api/content/pages/about", {
				method: "PUT",
				keepalive: true,
			});
			return response.status;
		});

		expect(unchangedStatus).toBe(204);
		expect(eventTypes(staticServer.getEvents())).not.toContain("save-start");

		const changedStatus = await page.evaluate(async () => {
			document.dispatchEvent(
				new CustomEvent("emdash:save", { detail: { state: "unsaved" } }),
			);
			const response = await fetch("/_emdash/api/content/pages/about", {
				method: "PUT",
				keepalive: true,
			});
			return response.status;
		});

		expect(changedStatus).toBe(200);
		const events = await waitForFixtureEvent(staticServer, (nextEvents) =>
			nextEvents.some((event) => event.type === "save-finish"),
		);
		expectEventOrder(events, ["save-start", "save-finish"]);
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
	});

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
