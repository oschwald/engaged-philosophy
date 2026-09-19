import { measureMissingPaths } from "../e2e/support/cache-usage.ts";
import {
	completeSetup,
	startWorkerServer,
} from "../e2e/support/worker-server.ts";

// A separate local state directory keeps this measurement out of e2e workers.
const server = await startWorkerServer(9000);
try {
	await completeSetup(server.baseURL);
	const { addedKeys, ...measurement } = await measureMissingPaths(server);
	server.assertNoErrors();
	console.log(
		JSON.stringify(
			{ ...measurement, addedCacheKeys: addedKeys.length },
			null,
			2,
		),
	);
} finally {
	await server.stop();
}
