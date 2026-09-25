# EmDash Customizations

This site is mostly a standard Astro + EmDash deployment, with a small set of
customizations kept for Cloudflare Access, WordPress parity, and free-plan
Cloudflare constraints.

## Runtime

- `src/lib/site-config.ts` is the shared source for non-secret site constants
  used by both the theme and Astro/EmDash configuration.
- `src/lib/cloudflare-access-auth.ts` authenticates EmDash users from Cloudflare
  Access JWTs. EmDash users still need to exist in the EmDash auth tables.
- `src/emdash-routes/cloudflare-access-invite.ts` replaces the default email
  invite flow with local user creation plus an admin URL, because sign-in is
  protected by Cloudflare Access. If configured, it also appends the invited
  email to a Zero Trust EMAIL list referenced by the admin Access policy.
- Astro's Cloudflare route-cache provider caches public HTML and generated site
  metadata in Workers Cache. `src/lib/cloudflare-cache-provider.ts` delegates
  header generation to the upstream provider and only skips tag purges when
  local Wrangler does not expose `cache.purge()`. This is the native Workers
  Caching path recommended by EmDash 0.33; the deprecated EmDash
  `cloudflareCache()` provider is not used here. EmDash 0.34 also makes route
  validators build-aware, so a browser cannot retain HTML that refers to assets
  from an earlier deployment.
- Public responses are fresh at the edge for one day and may be served stale
  for one hour while they revalidate. Browsers receive `max-age=0` and
  revalidate instead of retaining HTML or generated metadata independently.
  Cookie-bearing and query-string HTML responses are `no-store`; public HTML
  varies on `Cookie` so a cached anonymous response cannot hide that bypass.
- Page cache tags describe the content entry, collection lists, site settings,
  primary menu, and taxonomy data actually rendered. EmDash already invalidates
  entry and collection tags, and EmDash 0.32 avoids purging them for draft-only
  revision saves that cannot change public HTML. EmDash 0.37 also invalidates
  settings, menus, and taxonomy definitions/terms using its native `emdash:*`
  tags. MCP writes also invalidate the native route-cache tags. Content-term
  assignments invalidate the collection, entry (including translations), and
  taxonomy tags upstream as well, so no site middleware is needed. Term changes
  take effect immediately without publishing other pending draft edits.
- `src/js/emdash-save-gate.js` makes the visual-editing Publish and edit-mode
  controls wait for pending inline saves. EmDash 0.38 avoids saving unchanged
  Portable Text documents, so the local keepalive suppression is removed.
  Its toolbar can still publish before a Portable Text blur save finishes.
  After saves settle, the gate resumes EmDash's own publish button so 0.39's
  visual-action token, policy origin, error recovery, and reload stay upstream.
  The fetch tracker retains visible error feedback for rejected publish
  requests, which the upstream toolbar currently only logs to the console.
  The remaining gate preserves failed saves, including `409 ENTRY_LOCKED`,
  until a new save succeeds; a fast failure cannot be treated as an unchanged
  document and followed by publication or navigation. EmDash does not signal
  a clean document after undo, so undo alone cannot clear a previous failure;
  retry an edit successfully before using those toolbar controls.
- EmDash edit locks are enabled by default. Admin editors acquire a
  seven-minute lease, renewed every two minutes and on saves. Other users and
  API tokens can receive `409 ENTRY_LOCKED` on updates, publication,
  scheduling, draft discard, and deletion; same-user writes can proceed.
  Maintenance scripts should respect the lock or explicitly request
  `overrideLock`. The site's save gate does not bypass locks. EmDash 0.38's MCP
  content tools do not enforce them yet.
- Restoring trashed content creates an unscheduled draft, even if the entry
  was previously published. Editors must publish it again. Unpublishing also
  cancels any pending publication schedule.
- Zone WAF rules reject the two high-volume archival crawlers identified in
  production analytics. `src/worker.ts` retains the same check for preview URLs
  outside the zone, then logs selected admin/signed-in request metadata and
  slow observed requests without serializing cookie values.
  `public/robots.txt` advertises the same policy; robots directives alone do
  not enforce it. The [Free plan guardrails](cloudflare-free-plan-guardrails.md)
  describe the edge rules and remaining Worker checks.
- The outer Worker also applies a public request budget before Astro or EmDash
  initializes. It rejects unsupported methods and pathological URL shapes,
  validates preview-token syntax, bounds search queries and cursor history,
  and removes query parameters that public routes do not use. Search pages keep
  `s`, `cursor`, and `before`; preview, edit, and `/_emdash` requests retain
  their complete request state.
- Production caching relies on a zone Cache Rule that bypasses the shared cache
  for the stateful cookie names in `src/lib/request-state.ts`. Public HTML on
  the apex and `www` stops varying on arbitrary cookies only when
  `CACHE_STATEFUL_COOKIE_BYPASS_ACTIVE` is `"true"`, while the application
  still emits `no-store` for every recognized session, Access, preview, and
  edit request. The default retains `Vary: Cookie`, so deployments without the
  zone rule fail safely.
- `wrangler.jsonc` runs general EmDash maintenance every five minutes. This
  keeps the fixed-cost cleanup scans proportionate to a low-traffic site;
  scheduled publications can appear up to five minutes after their target
  time. EmDash 0.39 loads the scheduled handler lazily to reduce Worker startup
  work. EmDash 0.37 adds the scheduled-content index migration
  `074_content_deleted_scheduled_index` and bounds media-usage cleanup reads.
  Keep the five-minute cadence to limit the remaining fixed maintenance cost.
  EmDash 0.36 removed the separate Media Usage schedule; activation and repair
  now advance in bounded batches while an administrator keeps Settings ->
  Media usage tracking open.
- Core database migrations remain in EmDash's default automatic runtime mode.
  EmDash 0.35 and newer also emit the ignored `.emdash/migrations.json` build
  artifact for a future deployment-managed migration job; switching to check or
  manual mode should wait until such a job applies and verifies that exact
  manifest before every deploy. EmDash 0.38 includes `075_entry_edit_locks`,
  `076_collection_nav_group`, and `077_plugin_storage_revisions`. The last
  migration adds revision triggers to `options` and `_plugin_storage` without
  backfilling existing records. Monitor D1 writes after deployment and retain
  the five-minute maintenance cadence.
- D1 migrations serialize through a database lock that does not expire
  automatically. If a migration is interrupted, confirm no migrator is still
  running before following EmDash's
  [lock recovery procedure](https://docs.emdashcms.com/deployment/core-migrations/#release-a-stuck-migration-lock).
  Before deploying schema changes, retain a recovery point and rehearse against
  an isolated copy of current D1; fresh-database tests do not cover legacy data.

EmDash's backup page works with the existing R2 storage adapter and scheduled
Worker handler. Administrators can enable daily archives under Settings ->
Backups; archives contain content and media metadata, not media binaries, user
accounts, or secrets. Backup API calls require an API token with `admin` scope.
Keep a separate backup of media binaries.

For a complete move to an empty site, EmDash's `site export` and `site import`
commands transfer content, revisions, schema, settings, and media files in a
`.emdash` package. Keep these private exports out of git. Analyze the import
first, review its principal mappings and plan digest, and require a verified
receipt before sending visitors to the destination. An import blocks writes
while running; failed or cancelled imports that started writing remain blocked
until resumed or abandoned. This is separate from the scheduled metadata
backups above. Transfer tokens can use the narrower `transfer:export`,
`transfer:analyze`, and `transfer:execute` scopes instead of `admin`.

Taxonomy hierarchy and collection assignments are shared across locales;
labels remain localized. Change taxonomy structure through EmDash's API, MCP,
or seed tooling. Direct writes to the old per-locale definition columns do not
update the shared structure.

The upstream Cloudflare route-cache provider is used with response safeguards
for Cloudflare Access, preview, visual-editing, and other cookies. EmDash's
supported KV object cache is also enabled so expensive taxonomy aggregates and
content queries are shared across Worker isolates and Cloudflare locations.
It uses the existing `SESSION` namespace with the distinct
`ep:object-cache` key prefix; session and cached-content keys cannot collide.
The one-day cache TTL is only a cleanup backstop because EmDash invalidates
cached values with content and taxonomy epochs. Because Workers KV is
eventually consistent, another location can remain stale for about 60 seconds
(or occasionally longer), plus EmDash's default one-second isolate-local
`revalidate` window.

Nested public page lookups share a compact path-to-ID index under the fixed
`ep:page-paths:v1` query key. Its `contentNamespaces("pages")` epochs invalidate
it with the rest of the page collection. Unknown paths return 404 without
creating one KV query entry per URL; matched entries still use EmDash's normal
hydration and visibility checks. Stored path aliases remain available for
canonical redirects. Preview, visual editing, locale-specific requests, and
isolated database contexts retain the live lookup so drafts and locale
fallbacks are not restricted to the published index. Failed collection loads
never cache a partial index.

This deliberately trades a modest number of KV operations for much larger D1
row-read savings. Production D1 Insights showed a single topic-count query
scanning about 80,000 rows and route caching cannot share the result across
locations. The [KV free allowance](https://developers.cloudflare.com/kv/platform/limits/)
is 100,000 reads and 1,000 writes per day, while the
[D1 free allowance](https://developers.cloudflare.com/workers/platform/pricing/#d1)
is 5 million rows read per day. Monitor both metrics after deployment; cache
backend failures degrade to D1 reads rather than failing the request.

## Public Rendering

- Public entry annotations come directly from EmDash's `ContentEntry.edit`
  proxy; there is no site-level editing adapter. EmDash 0.38 also supplies
  working edit proxies for collection results.
- Collection query types come from EmDash's generated `emdash-env.d.ts`.
  Starting `pnpm run dev` regenerates the file from the local database; run it
  after changing the checked-in seed schema and include the generated update in
  the same commit. EmDash 0.37 also refreshes these declarations when the schema
  changes while the development server is running. `pnpm run check:emdash-types`
  starts an isolated local instance and fails when the committed declarations
  differ from the seed schema; the full CI command includes this check.
- Search uses EmDash full-text search, then batch-hydrates only the entries on
  the current result page. EmDash 0.34 indexes visible Portable Text prose
  instead of its JSON representation and avoids rewriting the FTS index for
  metadata-only saves. Searches are limited to 128 Unicode characters, cursors
  to 1024 characters, and 20 pages of cursor history. Archives use database
  limit/offset queries capped at 100 public pages, and exhaustive jobs such as
  the sitemap walk collection cursors.
- The page `path` field and project `highlight` and `menu_order` fields
  opt into EmDash 0.34's scalar-field indexes because public collection
  queries filter or sort on them. The project content list also shows highlight
  and menu order as native custom columns. These settings live in the seed for
  fresh databases and must be applied through Content Types once on an existing
  deployment because EmDash does not reapply seeds to live schemas.
- Archive labels use EmDash 0.37's `getTerm(..., { includeCounts: false })`,
  replacing the site's full taxonomy-list lookup. EmDash also avoids computing
  taxonomy usage counts during ordinary layout and editor prefetches. The
  project index still requests counts intentionally for its topic cloud;
  EmDash 0.32 drives that aggregate from the taxonomy pivot to avoid
  near-quadratic D1 row reads as the site grows.
- EmDash 0.33 persists manual taxonomy ordering. The upgrade migration keeps
  the existing English term order, and editors can reorder terms afterwards.
  The project topic cloud still applies its deliberate daily shuffle.
- Projects declare EmDash's native `/project/{slug}` collection URL pattern
  instead of persisting an identical imported `path` field. EmDash can
  therefore generate project references and automatic redirects after slug
  changes. The Astro `/projects/{id-or-slug}` compatibility route remains
  because preview links use it and the signed `_preview` query parameter must
  survive the redirect. The legacy root-slug alias also remains; replacing
  either route with one exact redirect row per project would increase cold
  redirect-cache reads on Workers Free.
- The base layout uses `EmDashHead`, `EmDashBodyStart`, and `EmDashBodyEnd` so
  EmDash SEO settings and plugin page contributions are rendered through the
  standard pipeline. EmDash 0.38 also overlays the SEO panel automatically on
  single-entry pages. `createSitePageContext()` still uses `getSeoMeta()` for
  the document title and collection-query fallbacks, which the overlay does
  not cover. The checked-in seed leaves collection SEO disabled; editors can
  opt in through Content Types. To enable it for fresh databases as well, add
  `"seo"` to the collection's seed supports. The SEO browser test enables it
  temporarily and checks metadata and JSON-LD across repeated visits.
- Posts declare `/{year}/{month}/{day}/{slug}` and derive theme links from
  the UTC publication date. `getPostByPath()` checks the complete date path
  after a slug lookup, so arbitrary dates cannot serve duplicate content.
  EmDash 0.39 adds plugin-context URL discovery, but no standalone forward URL
  builder for the theme, so `postPath()` still mirrors its date interpolation.
  Its UTC handling of offsetless input remains for compatibility; migration 079
  instead interprets stored offsetless values in the site timezone. The theme no
  longer reads stored post paths or falls back to creation dates.
  API, MCP, and CLI datetime writes must include `Z` or an explicit UTC offset.
- `/posts/{id-or-slug}` preserves signed preview tokens. Dated entries redirect
  to their canonical route (302 for preview, 301 otherwise); undated drafts
  render directly through EmDash's authorized preview context. The shared
  `PostPage.astro` keeps preview and published rendering consistent.
  `astro.config.mjs` sets `EMDASH_PREVIEW_PATH_PATTERN` to `/{collection}/{id}`
  at build time. EmDash's default preview resolver uses the collection URL
  pattern but leaves date placeholders unresolved, even for dated posts.
  Retain this override until it supplies the publication date and handles
  undated drafts; published permalink patterns are unchanged.
- The sitemap remains site-specific because nested page paths still need the
  page hierarchy adapter and the seed does not enable collection SEO. Posts
  and projects use their native date/slug patterns in the custom sitemap,
  which continues to honor EmDash noindex and canonical settings.
- Portable Text images use the EmDash renderer, including sanitized image links
  and imported links stored as strings. A narrow CSS compatibility
  layer preserves imported float dimensions, centers images when long captions
  widen their figures, and retains left/right placement when floats stack on
  small screens. Migrated images keep their reliable source width but omit
  unreliable imported heights, so they render directly from the public R2
  domain instead of consuming Cloudflare image transformations.
- Featured images use EmDash's native local-media metadata. The public content
  adapter maps each storage key directly to the public R2 domain once, so
  homepage, archive, and search renderers can use the normalized URL without
  retaining older seed-media shapes or repeating WordPress URL rewrites.
- Portable Text galleries delegate their markup, image loading, and captions to
  EmDash, and EmDash 0.31 keeps those native gallery blocks visible and editable
  in the admin editor. Imported gallery URLs are normalized to the public R2
  domain in both live content and revisions, so the site can pass each gallery
  directly to EmDash without a per-image URL adapter. The outer compatibility
  wrapper preserves imported shortcode/figure layouts, while CSP-safe column
  classes replace EmDash's inline `--columns` property because the production
  policy intentionally rejects inline styles. This avoids both Worker media
  proxy requests and Cloudflare image transformations on the Free plan.
  Gallery image references participate in EmDash's media usage tracking.
  EmDash 0.38's responsive gallery sizes improve image selection without
  requiring Cloudflare image transformations.
- Native Portable Text tables preserve semantic headers and spans. Their
  inline width and alignment styles are blocked by the anonymous-page CSP,
  although the admin and inline editor allow those styles. Verify public
  presentation before relying on the editor's table sizing and alignment
  controls.
- Imported numbered headings use EmDash's native Portable Text list and heading
  rendering. Their imported segments share one stable EmDash 0.33 `listId` and
  base, so EmDash emits semantic continuation starts across intervening answers.
  The remaining CSS only removes the heading's extra bottom margin; it does not
  implement numbering.
- Archive and search excerpts use EmDash's Portable Text plain-text extractor
  for standard blocks. The site adapter only preserves the imported image-alt
  and gallery-caption fallback behavior that EmDash cannot infer from the
  nested legacy gallery shape.
- Article author metadata uses the primary credit from EmDash's hydrated
  `data.bylines`. Imported WordPress author values were migrated to native
  byline profiles and credits, so there is no separate author field adapter.
  EmDash 0.34 exposes explicit credits directly from live-loader results.
- Legacy renderers remain for Animoto embeds, playlist videos, and dynamic page
  lists. EmDash does not support Animoto or the page-list behavior. Its
  self-hosted embed currently forces videos into 16:9 and omits intrinsic
  dimensions and `playsinline`, while its media component serves local files
  through the Worker. Imported legacy-video URLs are normalized to the public R2
  domain, so the remaining presentation adapter only validates the URL and
  preserves square and portrait videos, intrinsic dimensions, `playsinline`,
  and direct public-R2 delivery on the Cloudflare Free plan.

## Imported Field Names

EmDash system properties use camelCase (`createdAt`, `updatedAt`, and
`publishedAt`). Imported WordPress fields retain their persisted schema slugs,
which use snake_case (`featured_image` and `menu_order`). These names are
database and admin-schema identifiers, not a style choice in new application
code. New application-facing APIs should use camelCase and keep legacy names
inside content adapters. Renaming a persisted field requires a backup-backed
content/schema migration and should be handled separately from routine
refactoring.

## Cloudflare Access Invites

To let EmDash user invites grant Zero Trust access, create a Zero Trust
Reusable components EMAIL list for admin users and reference that list from the
Access policy protecting `/_emdash*`, either directly or through a reusable rule
group. Then configure the Worker with:

- `CLOUDFLARE_ACCESS_INVITE_ACCOUNT_ID`: the Cloudflare account ID.
- `CLOUDFLARE_ACCESS_INVITE_EMAIL_LIST_ID`: the Zero Trust EMAIL list ID.
- `CLOUDFLARE_ACCESS_INVITE_EMAIL_LIST_API_TOKEN`: a Worker secret with
  `Zero Trust Read` and `Zero Trust Write`.

The route uses the Zero Trust list append API. It does not replace Access groups
or policies at runtime, so concurrent manual removals from the list are not
restored by a stale full-group write.

If both the list ID and API token are absent, the invite route still creates the
EmDash user and returns the admin URL plus a manual Access reminder, even if the
account ID is present. If either the list ID or API token is set without the
other required values, the route fails closed with `ACCESS_CONFIG_ERROR`.

## Plugins

- The upstream audit-log descriptor runs through EmDash's standard-format
  adapter for trusted in-process execution, so it works without Dynamic Worker
  loaders on the current Cloudflare plan. Audit-log 0.2.1 declares the required
  capabilities itself, so the local descriptor override is removed. EmDash 0.37
  supplies the existing content ID to its before-save hook. EmDash 0.38 and
  audit-log 0.2.2 also attribute content saves to the authenticated actor while
  preserving the entry owner.
- The upstream embeds plugin registers and renders the enabled YouTube and Vimeo
  blocks directly. Its `astro-embed` dependency is overridden to 0.14.0, which
  is API-compatible with the plugin and declares support for the site's Astro 7
  runtime; the plugin's 0.12 dependency otherwise leaves an invalid peer graph.
  This version also uses Astro-compatible `astro-auto-import` directly, so the
  nested auto-import override is removed.
- `src/plugins/legacy-content-blocks.ts` preserves edit controls for imported
  WordPress-only Portable Text blocks such as playlist videos, remaining legacy
  embeds, and page lists. Its registered plugin ID remains
  `legacy-image-blocks` for compatibility with existing plugin state.
- EmDash 0.38 validates plugin outbound requests through DNS lookups at
  `cloudflare-dns.com`. The Cloudflare Access invite integration uses its own
  fetch path. Configured plugins still run without paid Worker Loaders; the
  sandbox changes do not require enabling that binding.

## Build Compatibility

- `astro.config.mjs` sets the Vite chunk-size warning limit to 4096 kB. The
  upstream admin application still exceeds it; ordinary public pages do not
  load that bundle. EmDash's plugin-navigation icon fallback dynamically
  imports the full Phosphor export namespace, retaining all browser icons and
  its re-exported server icon namespace. Reducing that payload needs an
  upstream import change; splitting it into chunks alone does not remove the
  unused icons.
  [Upstream icon resolver](https://github.com/emdash-cms/emdash/blob/emdash%400.37.0/packages/admin/src/components/admin-navigation-icons.ts)
- TypeScript remains at 6.0.3 because typescript-eslint 8.70 requires a version
  below 6.1, and `@astrojs/check` 0.9.10 supports TypeScript 5 and 6. The current
  TypeScript 7 release is outside both peer ranges.
- `@astrojs/react` 7 uses Oxc for JSX and Fast Refresh. The site uses plain
  `react()` without custom Babel options, so no configuration change is needed.
- Miniflare pins patched Sharp, so no local Sharp override is needed.
  The global Undici override is also removed: Miniflare selects patched 7.29.0
  itself, while Astro's font loader requires Undici 8.
  [Sharp advisory](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c)
- Media uploads retain EmDash's safer default allowlist, which accepts AVIF and
  other raster image formats but not SVG. Site-owned SVG icons remain versioned
  static assets.
- `wrangler.jsonc` enables Workers Cache with per-deployment version isolation
  and enables Cloudflare logs/traces. A deployment starts with a cold route
  cache; stale entries are not reused across Worker versions.

## Removal Candidates

- Remove the `astro-embed` override when the embeds plugin depends on 0.13.1 or
  newer directly.
- Revisit the visual-editing save gate when the upstream toolbar explicitly
  waits for Portable Text saves before publishing or leaving edit mode. The
  0.37 publish-before-save fix applies to the admin content editor; the inline
  toolbar still needs this gate in 0.39.1.
- Remove the local cache-provider wrapper when Wrangler exposes
  `cache.purge()` for its local Workers Cache implementation. Wrangler 4.137.0
  still lacks it locally.
- Revisit the custom invite route if site email is configured and the default
  EmDash invite flow works with the chosen auth provider. EmDash 0.27 added a
  Cloudflare Email Sending plugin, but that only handles email delivery; this
  site still needs invitees appended to the Cloudflare Access EMAIL list.

## Post URL Migration

### Completed migration

[PR #171](https://github.com/oschwald/engaged-philosophy/pull/171) migrated posts
to EmDash's native UTC date pattern on September 15, 2026. The audit found 80
posts: 76 published and four undated drafts. Fourteen publication timestamps
were moved into the final milliseconds of their existing URL's UTC day,
preserving all published URLs, displayed Pacific dates, and publication order.
The approved time changes also affect RSS and machine-readable metadata;
exact publication times are not displayed. Undated drafts remain undated.

SQL cleanup removed `path` from all 131 post revisions before EmDash's schema
registry removed the stored Posts `path` field. Editing was paused across both
steps and then resumed. Every other post value, all page records, and all
redirects were unchanged; media usage tracking returned to Ready.

The migrated database copy passed all 1,047 inventoried paths: 419 pages and
628 permanent redirects. All 244 content canonical URLs matched the live
baseline, the final live sitemap retained those URLs, and all 419 public paths
passed the final sequential production smoke check.

### Audit records and recovery

Keep the private backups and full path inventory under the ignored
`.migration/post-paths/` directory:

- `before.sql` and `before-field-removal.sql`: regular-table database exports.
  FTS5 definitions, indexes, and triggers are saved separately in
  `schema-revisions-redirects-before.json` and the audit files. Restore these
  schema objects and rebuild the derived full-text indexes when recovering.
- `posts-before.json`, `backup.json`, `before-field-removal-audit.json`, and
  `after-field-removal-audit.json`: original data and cleanup comparisons.
- `production-deployment.json`, `cleanup-live-result.json`, and
  `migration-status.json`: deployment, cleanup, and final verification records.
- `content-paths.txt`: all 244 published content paths; `public-paths.txt`: 419
  content, index, and archive paths; `all-html-paths.txt` and
  `path-inventory.json`: 1,047 paths including aliases and exact redirects.
- `sitemap-before.xml` and `checks-before.json`: original sitemap and live
  status/canonical baseline. `smoke-final-sequential.log` records the final
  production smoke check.

The retired migration tools and full rollout procedure remain available in
[the migration commit](https://github.com/oschwald/engaged-philosophy/tree/9761d37b5f1b219eaf9c66044d729dd402238363).
Rolling back to code that queries stored post paths requires restoring the
field and its backed-up values. EmDash 0.38 replays revision properties as
column assignments, so revisions containing `path` must be cleaned before
removing that field again. Direct database restores also require invalidating
the relevant KV object-cache namespaces; Worker deployment only clears its
version-specific HTML cache.

Use the saved public path list for future deployed checks:

```sh
LIVE_SMOKE_PATH_FILE=.migration/post-paths/public-paths.txt \
  LIVE_SMOKE_CONCURRENCY=1 LIVE_SMOKE_DELAY_MS=1300 pnpm run smoke:live
```

The JSON inventory also records XML endpoints; check those separately from the
HTML path list.

### Ongoing behavior

Ordinary content edits keep the publication date and URL. Slug edits use
EmDash's native permanent redirects. Changing an already-published post's
publication date can move its URL; EmDash 0.38 does not create a redirect for a
date-only edit, so add an exact redirect as part of that change. Undated drafts
continue to need the `/posts/{id}` preview route.
