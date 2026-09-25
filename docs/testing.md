# Testing

## Toolchain

Use `mise install` to install the pinned Node and pnpm versions from
`mise.toml`, then run `pnpm install --frozen-lockfile`. Runtime dependencies that
are not installed by pnpm should be added to `mise.toml` so CI and local shells
use the same versions.

The project uses four test layers:

- `tests/`: Vitest checks for configuration, seed safety, plugins, and other
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

- `pnpm run test` runs Vitest and static Playwright tests.
- `pnpm run test:seed` runs only the checked-in seed guard.
- `pnpm run test:e2e` runs the Worker-backed Playwright suite.
- `pnpm run test:e2e:admin`, `pnpm run test:e2e:editing`, and
  `pnpm run test:e2e:public` run focused Worker-backed Playwright groups.
- `pnpm run smoke:live` runs lightweight checks against
  `https://www.engagedphilosophy.com`. Set `LIVE_BASE_URL` to target another
  deployment. The smoke test requests one public page twice and requires
  Cloudflare's second response to report a cache hit (or a stale/revalidated
  equivalent).
- `pnpm run smoke:live:sitemap` runs the deployed smoke checks plus every same
  origin URL listed in the sitemap, and fails if the sitemap is empty.
- Use `LIVE_SMOKE_PATH_FILE` with `pnpm run smoke:live` to check one URL/path
  per line from a custom list.
- `pnpm run ci` runs linting, fast tests, typecheck, build, Worker checks, and
  Worker-backed Playwright.

Wrangler's local runtime exposes route-cache headers but does not currently
emulate production tag purging or `CF-Cache-Status`. The Worker-backed cache
tests therefore verify cache policy, tags, stateful/query bypasses, and content
refresh behavior locally; `pnpm run smoke:live` is the production cache-hit
check after deployment.

## Branch Previews

Workers Builds currently publishes branch and commit previews as aliased Worker
Version URLs. These versions bind to the same D1 database, R2 bucket, and KV
namespace as production; a different hostname does not isolate data. EmDash's
automatic runtime migrations can change that shared database when a preview
initializes, including on a read request. Use isolated local bindings for test
writes and migration rehearsals. Changes to shared live data need explicit
authorization.

Cloudflare Access protects preview admin routes. The local e2e test-auth build
does not validate that Access configuration. If admin APIs return `401` after
an upgrade, check database migration status as well as authentication: a failed
runtime initialization can leave EmDash without a resolved user and surface as
`Authentication required`.

Cloudflare does not provide Workers Logs, Wrangler tail, or Logpush for
[Version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/#limitations).
Use browser response details and an isolated local reproduction to diagnose
preview failures; production logs do not show these requests.

## Local KV Measurement

Run `mise exec -- node scripts/measure-kv-usage.mjs` to build a test-auth Worker,
initialize isolated local bindings, and request 100 distinct missing nested
paths after warming the homepage and a 404. The script reports object-cache
key growth, database query counts from `Server-Timing`, and response latency.
Key growth measures new entries, not repeated writes to existing keys; query
counts are not D1 rows read, and local timings are not production CPU usage.

The measurement resets only `.wrangler/e2e-state/worker-9000`. It uses local
Wrangler bindings and never targets a deployed site. Its build uses test auth;
run a normal `pnpm run build` before any deployment.
