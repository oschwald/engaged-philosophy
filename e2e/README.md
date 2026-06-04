# E2E Tests

End-to-end tests live under `e2e/` and use the standard Playwright runner.
These tests cover browser-visible behavior and Cloudflare Worker integration.
Prefer user-facing page tests for admin and public workflows. Use API helpers
for setup or focused assertions when browser setup would obscure the behavior
being covered.

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
- `PLAYWRIGHT_VIDEO=1 npm run test:e2e` records failure videos when traces and
  screenshots are not enough.

Playwright global setup builds once with `EMDASH_TEST_AUTH=1`. The Worker
fixture starts `wrangler dev` against that build, applies `.emdash/seed.json`
without content, and uses the `X-EmDash-Test-Auth` header for authenticated
admin requests.
