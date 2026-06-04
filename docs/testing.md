# Testing

The project uses four test layers:

- `tests/`: Vitest checks for transforms, configuration, seed safety, and other
  Node-only behavior.
- `e2e-static/`: Playwright browser fixtures for custom frontend code that does
  not need a Worker.
- `e2e/`: Playwright tests against a built Cloudflare Worker with the checked-in
  EmDash seed applied.
- `scripts/test-worker-bundle.mjs` and `scripts/test-worker-runtime.mjs`: build
  artifact checks for Worker deployability and production startup.

Prefer the smallest layer that exercises the behavior from the user's
perspective. For example, put WordPress transform edge cases in Vitest, save-gate
browser timing in `e2e-static/`, and admin/public workflows in `e2e/`.

## Commands

- `npm test` runs Vitest and static Playwright tests.
- `npm run test:seed` runs only the checked-in seed guard.
- `npm run test:e2e` runs the Worker-backed Playwright suite.
- `npm run smoke:live` runs lightweight checks against a deployed site. Set
  `LIVE_BASE_URL` to target a non-default hostname.
- `npm run ci` runs linting, fast tests, typecheck, build, Worker checks, and
  Worker-backed Playwright.
