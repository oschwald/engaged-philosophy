export const env = {};
export const cachePurgeCalls: unknown[] = [];

let cachePurgeSupported = true;
let cachePurgeResult = { success: true, errors: [] } as {
	success: boolean;
	errors: Array<{ code: number; message: string }>;
};

export function resetCachePurgeMock() {
	cachePurgeCalls.length = 0;
	cachePurgeSupported = true;
	cachePurgeResult = { success: true, errors: [] };
}

export function setCachePurgeSupported(supported: boolean) {
	cachePurgeSupported = supported;
}

export function setCachePurgeResult(result: typeof cachePurgeResult) {
	cachePurgeResult = result;
}

export const cache = {
	get purge() {
		if (!cachePurgeSupported) return undefined;

		return async (options: unknown) => {
			cachePurgeCalls.push(options);
			return cachePurgeResult;
		};
	},
};
