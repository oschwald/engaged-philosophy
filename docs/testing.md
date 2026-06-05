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
- `npm run test:e2e:admin`, `npm run test:e2e:editing`, and
  `npm run test:e2e:public` run focused Worker-backed Playwright groups.
- `npm run smoke:live` runs lightweight checks against a deployed site. Set
  `LIVE_BASE_URL` to target a non-default hostname.
- `npm run smoke:live:sitemap` runs the deployed smoke checks plus every same
  origin URL listed in the sitemap. Empty sitemaps are skipped; set
  `LIVE_SMOKE_REQUIRE_SITEMAP=1` for a strict launch check.
- `npm run smoke:live:wordpress` checks every published page/post/project path
  from the local WordPress export against `LIVE_BASE_URL`. Use
  `LIVE_SMOKE_WORDPRESS_LIMIT` for a smaller sample, or `LIVE_SMOKE_PATH_FILE`
  with `npm run smoke:live` to check one URL/path per line from a custom list.
- `npm run ci` runs linting, fast tests, typecheck, build, Worker checks, and
  Worker-backed Playwright.
