# Unit And Integration Tests

Vitest tests live under `tests/` and cover pure functions, transform logic,
configuration guards, and fast integration checks that do not need a browser or
a built Worker.

## Layout

- `unit/` covers small pure modules and config helpers.
- `integration/` covers multi-module behavior that still runs in a plain Node
  process.
- `support/` contains shared fixtures and test helpers.

Keep browser-visible behavior in Playwright specs: `e2e-static/` for browser
fixtures that do not need a Worker, and `e2e/` for real Worker-backed public
site and admin workflows. Keep build and Worker startup checks in their script
runners.

## Commands

- `pnpm run test:unit` runs the Vitest suite once.
- `pnpm run test:seed` runs only the checked-in EmDash seed guard.
- `pnpm run test:unit:watch` runs Vitest in watch mode.
