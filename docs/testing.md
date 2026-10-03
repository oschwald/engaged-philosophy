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

Both Playwright suites use the Chromium version installed by Playwright.
If it is missing, run `pnpm exec playwright install --with-deps chromium`.
Set `PLAYWRIGHT_BROWSER_PATH` to an explicit executable path when a different
browser is required. Both suites honor this override. An invalid path fails
at launch instead of falling back to a system browser.

Wrangler's local runtime exposes route-cache headers but does not currently
emulate production tag purging or `CF-Cache-Status`. The Worker-backed cache
tests therefore verify cache policy, tags, stateful/query bypasses, and content
refresh behavior locally; `pnpm run smoke:live` is the production cache-hit
check after deployment.

## Branch Previews

### Preview flows and isolation

Builds configured with `pnpm exec wrangler versions upload` publish aliased
Version URLs. Those URLs share production D1, R2, and KV. Runtime migrations can
write to production even on read requests. Do not use those URLs for migration
rehearsals or test writes. Verify the Builds deploy command before choosing a
preview for testing.

The checked-in native `previews` configuration instead uses these shared staging
resources, separate from production:

| Binding | Preview resource                                                             |
| ------- | ---------------------------------------------------------------------------- |
| DB      | D1 `engaged-philosophy-preview` (`0d0c311a-1b53-47d0-a7f7-adcc04918479`)     |
| SESSION | KV `engaged-philosophy-preview-session` (`493953d8fd1c4d85a1dac523013d6d4d`) |
| MEDIA   | R2 `engaged-philosophy-preview-media`                                        |

These resources are shared across native branch previews. Content edits and
runtime migrations in one preview affect the others. For an incompatible schema
change, prepare another isolated resource set or coordinate a staging refresh.
There is no automatic production snapshot on branch builds.

Production uses the default Wrangler configuration. Do not pass `--env production`.
`preview_urls: true` remains enabled. The `previews` block applies to native
`wrangler preview`, not `versions upload`. See Cloudflare's
[configuration rules](https://developers.cloudflare.com/workers/previews/configuration/)
and [resource isolation](https://developers.cloudflare.com/workers/previews/resources/).

Native preview media uses `SITE_PREVIEW=true` and the same-origin
`/_emdash/api/media/file/<key>` endpoint backed by preview R2. Production keeps
`https://media.engagedphilosophy.com`. Canonical and structured-data site URLs stay
on the production site. Imported media keys are regenerated for target storage.
Existing absolute production URLs in legacy content can remain read-only references.
New or replaced preview uploads must use preview media URLs. The unconfigured logo
uses the static `/img/logo.png` asset. Keep editor-selected logo and favicon settings.

### Controlled snapshot

Use EmDash's native [site transfer](https://docs.emdashcms.com/guides/site-transfer/)
for an initial snapshot. It exports schema, content, revisions, public settings,
and ready media bytes. It excludes users, credentials, sessions, API tokens,
plugin secrets, preview signing secrets, backups, and operational state.
Principals contain source user IDs, names, and emails for mapping to preview users.
Treat the archive as private content. Do not commit it or copy the entire R2 bucket.
Do not use a remote D1 SQL export as the snapshot path.

The target portable domain must be empty. Setup scaffolding from the checked-in
seed is allowed and appears as `seeded_scaffold_removed` in the native plan.
Create preview users through setup/admin first because Access auto-provisioning
is disabled. Never import production authentication records. Configure a separate
preview API token for transfer and revoke it after the operation.

Use authenticated EmDash CLI sessions for each URL. If Access requires headers,
use the CLI's `EMDASH_HEADERS` support through a protected shell
session. Do not put credentials in command arguments, repository files, or logs.
Run these commands only during an authorized snapshot operation:

```sh
mise exec -- pnpm exec emdash site export --url "$SOURCE_URL" --output "$SNAPSHOT_FILE"
mise exec -- pnpm exec emdash site import "$SNAPSHOT_FILE" --url "$PREVIEW_URL" --analyze
```

Review the plan's blockers, counts, warnings, settings, and principal mappings.
Use `--map-principal 'source-email=preview-email'` with `--analyze` when the
suggested mappings need correction. Verify logo/favicon media references, legacy
image rendering, custom blocks, menus, and locale compatibility. Only execute
an unblocked reviewed plan:

```sh
mise exec -- pnpm exec emdash site import "$SNAPSHOT_FILE" --url "$PREVIEW_URL" --plan "$PLAN_DIGEST" --confirm
mise exec -- pnpm exec emdash site import receipt "$IMPORT_ID" --url "$PREVIEW_URL" --json
```

Require a complete operation, `verification: verified`, and a valid receipt digest.
Check imported public content and download an imported image using its target URL.
Native import regenerates storage keys, so source media URLs are not a target
verification path. An analysis warning about a missing logo/favicon media row
requires operator review, not a bucket-wide copy.

A later refresh requires a deliberate reset/reseed of staging or a new resource
set, followed by the same analyzed import. Do not reset shared preview data while
other branches are using it. A failed or cancelled import can leave partial data
and block writes. Inspect `site import status`, then follow native cancel/abandon
instructions. Abandoning does not undo imported data.

### One-time activation

Resource configuration alone does not activate native previews or populate staging.
Keep the current Builds commands until this switch is reviewed:

1. Build normally with test-auth flags unset. Inspect `dist/server/wrangler.json`:
   preview DB/SESSION/MEDIA must point at the table above, `SITE_PREVIEW` must be
   `true`, and production routes/crons must remain at the top level.
2. Set `CF_ACCESS_AUDIENCE` separately in Previews Base using
   `pnpm exec wrangler preview base-config secret put CF_ACCESS_AUDIENCE`.
   Leave `CLOUDFLARE_ACCESS_INVITE_ACCOUNT_ID`,
   `CLOUDFLARE_ACCESS_INVITE_EMAIL_LIST_ID`, and
   `CLOUDFLARE_ACCESS_INVITE_EMAIL_LIST_API_TOKEN` absent in previews. This selects
   manual invitation mode without writes to the production Access allow-list.
   Do not copy partial invitation-sync config or the production API token. Base secrets apply only to newly
   created previews, so refresh existing previews deliberately after changes.
3. Create an isolated native preview with `pnpm exec wrangler preview --name snapshot-setup`.
   Check Access coverage for its returned hostname before exposing private data.
   Create preview users and perform the analyzed snapshot import above.
4. In Workers & Pages > your Worker > Settings > Builds, select Set up in
   the Set up Worker Previews banner and review the preview bindings and command. Cloudflare's
   [one-time setup](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)
   cannot be undone. Keep the build command `pnpm run build`, set the
   non-production deploy command to `pnpm exec wrangler preview`, and preserve
   production deployment as `pnpm exec wrangler deploy`.
5. Trigger one branch build. Verify the returned native preview's bindings,
   authenticated admin access, edit/save/publish, uploaded image bytes, public
   pages, and cache behavior. Confirm production content and sessions did not
   change. New preview writes must remain within the staging bindings.

Access covers preview hosts and admin routes separately from the zone WAF.
Local test-auth checks do not verify the deployed Access configuration.
Native previews support their own logs. Old
[Version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/#limitations)
do not support Workers Logs, Wrangler tail, or Logpush.

## Local Cost Measurement

Run `mise exec -- node scripts/measure-kv-usage.mjs` to build a test-auth Worker
and populate isolated local content. The script measures home, a page with the
sidebar, a project with topics, a taxonomy archive, and public search. Each route
has one cold request and five repeats. Cold means the first measured request
after clearing persistent object-cache keys, not a new isolate. Earlier requests
can warm shared runtime state. TTFB measures response headers arriving at the local
client. Full-response time includes consuming the response body.

The 404 group warms the home route, measures a first missing path and five repeats,
then requests 100 distinct missing nested paths. It reports database query counts
from `Server-Timing`, TTFB/full-response timing, and new object-cache key deltas.
Key deltas do not count repeated writes to existing keys. Anonymous route-cache
fills can deliberately bypass object-cache writes, so zero key growth is valid.
These local checks do not measure D1 rows read, KV read/write operations, Worker
CPU, or production edge hits. Use the [Cloudflare usage review](cloudflare-free-plan-guardrails.md#usage-review) for those.

The measurement resets only `.wrangler/e2e-state/worker-9000`, uses local bindings,
and never targets deployed URLs. Its build uses test auth. Run a normal
`pnpm run build` before packaging or deployment.
