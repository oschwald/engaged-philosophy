import assert from "node:assert/strict";
import type { WorkerServer } from "./worker-server";

export async function measureMissingPaths(server: WorkerServer, count = 100) {
	const prefix = `/kv-measurement-${Date.now()}`;
	const request = async (path: string) => {
		const started = performance.now();
		const response = await fetch(`${server.baseURL}${path}`, {
			redirect: "manual",
			signal: AbortSignal.timeout(15_000),
		});
		await response.arrayBuffer();
		const timing = response.headers.get("server-timing") ?? "";
		const queries = timing.match(/(?:^|,\s*)db\.count;dur=(\d+)/);
		assert.ok(timing.includes("mw;"), "Expected local Worker timing metrics");
		return {
			status: response.status,
			elapsedMs: performance.now() - started,
			// EmDash omits db.count when the request does not query the database.
			dbQueries: queries ? Number(queries[1]) : 0,
		};
	};

	assert.equal((await request("/")).status, 200);
	const cold = await request(`${prefix}/warmup`);
	assert.equal(cold.status, 404);
	const before = new Set(await server.listObjectCacheKeys());
	let dbQueries = 0;
	const durations: number[] = [];
	for (let i = 0; i < count; i++) {
		const result = await request(`${prefix}/missing-${i}`);
		assert.equal(result.status, 404);
		dbQueries += result.dbQueries;
		durations.push(result.elapsedMs);
	}
	const after = await server.listObjectCacheKeys();
	const addedKeys = after.filter((key) => !before.has(key));
	durations.sort((a, b) => a - b);
	return {
		requests: count,
		cold,
		cacheKeysBefore: before.size,
		cacheKeysAfter: after.length,
		addedKeys,
		dbQueries,
		medianMs: Math.round(durations[Math.floor(count / 2)]),
		p95Ms: Math.round(durations[Math.ceil(count * 0.95) - 1]),
	};
}
