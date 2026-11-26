import { assertNoTestAuthEnv } from "./test-auth-build.mjs";

// Run before the deploy build: with test-auth variables set, the build would
// produce a test-auth Worker instead of the deployable one.
assertNoTestAuthEnv();
