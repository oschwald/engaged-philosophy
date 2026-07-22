export const env = {};
export const cachePurgeCalls: unknown[] = [];
export const cache = {
	async purge(options: unknown) {
		cachePurgeCalls.push(options);
		return { success: true, errors: [] };
	},
};
