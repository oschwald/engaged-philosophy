import { buildWorkerForE2E } from "./support/worker-server";

export default async function globalSetup() {
	buildWorkerForE2E();
}
