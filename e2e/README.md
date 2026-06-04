# E2E Tests

End-to-end tests live under `e2e/` and use the standard Playwright runner.
These tests cover browser-visible behavior and Cloudflare Worker integration.

## Layout

- `fixtures/` contains Playwright fixtures, including the local Worker/test-auth harness.
- `support/` contains shared assertions and Worker lifecycle helpers.
- `specs/public/` covers public site rendering and navigation.
- `specs/admin/` covers EmDash admin pages and APIs.
- `specs/editing/` covers visual editing and save/publish flows.

Keep pure transform, seed, config, and migration checks in the existing script
tests unless they need a real browser or Worker runtime.

## Commands

- `npm run test:e2e` runs the Playwright suite headlessly.
- `npm run test:e2e:headed` runs the suite with a visible browser.
- `npm run test:e2e:ui` opens the Playwright UI runner.

The Worker fixture builds with `EMDASH_TEST_AUTH=1`, starts `wrangler dev`
against the built Worker, applies `.emdash/seed.json` without content, and
uses the `X-EmDash-Test-Auth` header for authenticated admin requests.
