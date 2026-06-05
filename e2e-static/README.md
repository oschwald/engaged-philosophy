# Static Browser Tests

Static Playwright tests live under `e2e-static/`. They exercise browser
behavior against small local fixtures when a full Cloudflare Worker, database,
or EmDash admin setup would make the test slower without improving coverage.

## Layout

- `fixtures/` contains fixture servers and Playwright fixture wiring.
- `specs/` contains browser tests that run against those fixtures.

Use this suite for custom frontend code that can be verified with a minimal
HTML page, such as the EmDash save gate. Use `e2e/` when the behavior depends on
Astro rendering, EmDash APIs, Cloudflare bindings, or real admin navigation.

## Commands

- `pnpm run test:static` runs the static Playwright suite headlessly.
- `pnpm run test:static:headed` runs it with a visible browser.
- `pnpm run test:static:ui` opens the Playwright UI runner.
