# Unit And Integration Tests

Vitest tests live under `tests/` and cover pure functions, transform logic,
configuration guards, and fast integration checks that do not need a browser or
a built Worker.

## Layout

- `unit/` covers small pure modules and config helpers.
- `integration/` covers multi-module behavior that still runs in a plain Node
  process.
- `support/` contains shared fixtures and test helpers.

Keep browser-visible behavior in `e2e/` Playwright specs. Keep build, Worker,
and full rendered-site smoke checks in their existing script runners unless
they become cheap, deterministic Node tests.

## Commands

- `npm run test:unit` runs the Vitest suite once.
- `npm run test:unit:watch` runs Vitest in watch mode.
