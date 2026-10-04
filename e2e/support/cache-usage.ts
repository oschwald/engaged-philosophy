import assert from "node:assert/strict";
import type { WorkerServer } from "./worker-server";

export async function measureRequest(server: WorkerServer, path: string) {
	const started = performance.now();
	const response = await fetch(`${server.baseURL}${path}`, {
		redirect: "manual",
		signal: AbortSignal.timeout(15_000),
	});
	const ttfbMs = performance.now() - started;
	await response.arrayBuffer();
	const timing = response.headers.get("server-timing") ?? "";
	const queries = timing.match(/(?:^|,\s*)db\.count;dur=(\d+)/);
	assert.ok(timing.includes("mw;"), "Expected local Worker timing metrics");
	return {
		status: response.status,
		ttfbMs,
		elapsedMs: performance.now() - started,
		// EmDash omits db.count when the request does not query the database.
		dbQueries: queries ? Number(queries[1]) : 0,
	};
}

export async function measureMissingPaths(server: WorkerServer, count = 100) {
	const prefix = `/kv-measurement-${Date.now()}`;
	const request = (path: string) => measureRequest(server, path);

	assert.equal((await request("/")).status, 200);
	const cold = await request(`${prefix}/warmup`);
	assert.equal(cold.status, 404);
	const warm = [];
	for (let i = 0; i < 5; i++) {
		const result = await request(`${prefix}/warmup`);
		assert.equal(result.status, 404);
		warm.push(result);
	}
	const before = new Set(await server.listObjectCacheKeys());
	let dbQueries = 0;
	const durations: number[] = [];
	const firstBytes: number[] = [];
	for (let i = 0; i < count; i++) {
		const result = await request(`${prefix}/missing-${i}`);
		assert.equal(result.status, 404);
		dbQueries += result.dbQueries;
		durations.push(result.elapsedMs);
		firstBytes.push(result.ttfbMs);
	}
	const after = await server.listObjectCacheKeys();
	const addedKeys = after.filter((key) => !before.has(key));
	durations.sort((a, b) => a - b);
	firstBytes.sort((a, b) => a - b);
	return {
		requests: count,
		cold,
		warm,
		medianTtfbMs: Math.round(firstBytes[Math.floor(count / 2)]),
		p95TtfbMs: Math.round(firstBytes[Math.ceil(count * 0.95) - 1]),
		cacheKeysBefore: before.size,
		cacheKeysAfter: after.length,
		addedKeys,
		dbQueries,
		medianMs: Math.round(durations[Math.floor(count / 2)]),
		p95Ms: Math.round(durations[Math.ceil(count * 0.95) - 1]),
	};
}

export async function measureRepresentativePaths(
	server: WorkerServer,
	paths: Array<{ name: string; path: string }>,
	warmRequests = 5,
) {
	const results = [];
	for (const { name, path } of paths) {
		// Each route starts with an empty persistent object cache.
		await server.clearObjectCacheKeys();
		const before = new Set(await server.listObjectCacheKeys());
		const cold = await measureRequest(server, path);
		assert.equal(cold.status, 200);
		const warm = [];
		for (let i = 0; i < warmRequests; i++)
			warm.push(await measureRequest(server, path));
		assert.ok(warm.every(({ status }) => status === 200));
		const after = await server.listObjectCacheKeys();
		results.push({
			name,
			path,
			requests: 1 + warmRequests,
			cold,
			warm,
			addedCacheKeys: after.filter((key) => !before.has(key)).length,
		});
	}
	return results;
}
