import { rm } from "node:fs/promises";

import { buildOutDir } from "./test-auth-build.mjs";

// Clean only the output for this build mode, so a test-auth build leaves the
// deployable build in dist/ alone.
await rm(buildOutDir(), { recursive: true, force: true });
