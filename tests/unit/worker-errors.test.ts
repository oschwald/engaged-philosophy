import { describe, expect, test } from "vitest";

import { hasWorkerErrors } from "../../scripts/worker-errors.mjs";

describe("Worker log errors", () => {
	test.each([
		"[ERROR] Failed to start",
		"✘ [ERROR] Runtime failure",
		"ReferenceError: missing binding",
		"Cannot access config before initialization",
		"Unhandled rejection",
		"EmDash middleware error",
		"Cannot read properties of undefined (reading 'every')",
	])("detects %s", (output) => {
		expect(hasWorkerErrors(output)).toBe(true);
	});

	test("accepts ordinary startup output", () => {
		expect(
			hasWorkerErrors("Ready on http://localhost:8787\nGET / 200 OK"),
		).toBe(false);
	});
});
