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
  revision saves that cannot change public HTML. Site middleware adds settings,
  primary-menu, and taxonomy invalidation, batching every affected tag into one
  purge request. This keeps the additional purge load small on Workers Free.
- `src/js/emdash-save-gate.js` makes the visual-editing Publish and edit-mode
  controls wait for pending inline saves. EmDash 0.31 flushes edits when the
  browser navigates away, but its toolbar can still publish before a Portable
  Text blur save finishes. The gate also ignores redundant keepalive saves when
  EmDash reports no unsaved changes, while retaining the unload protection for
  real edits.
- `src/worker.ts` logs selected admin/signed-in request metadata and slow
  observed requests without serializing cookie values.
- `wrangler.jsonc` runs general EmDash maintenance every minute and the bounded
  Media Usage lane every two minutes. EmDash 0.34 uses the second schedule to
  reconcile existing content in resumable background batches; sharing one
  schedule no longer drives both kinds of work.

EmDash's backup page works with the existing R2 storage adapter and scheduled
Worker handler. Administrators can enable daily archives under Settings ->
Backups; archives contain content and media metadata, not media binaries, user
accounts, or secrets.

The upstream Cloudflare route-cache provider is used with response safeguards
for Cloudflare Access, preview, visual-editing, and other cookies. The EmDash KV
object cache is still intentionally disabled on Workers Free: the
[KV free allowance](https://developers.cloudflare.com/kv/platform/limits/) is
100,000 reads and 1,000 writes per day, while the
[D1 free allowance](https://developers.cloudflare.com/workers/platform/pricing/#d1)
is 5 million rows read per day. Workers Cache avoids most repeat D1 work without
consuming the smaller KV write budget or requiring a paid service.

## Public Rendering

- Public entry annotations come directly from EmDash's `ContentEntry.edit`
  proxy; there is no site-level editing adapter.
- Collection query types come from EmDash's generated `emdash-env.d.ts`.
  Starting `pnpm run dev` regenerates the file from the local database; run it
  after changing the checked-in seed schema and include the generated update in
  the same commit. `pnpm run check:emdash-types` starts an isolated local
  instance and fails when the committed declarations differ from the seed
  schema; the full CI command includes this check.
- Search uses EmDash full-text search, then batch-hydrates only the entries on
  the current result page. EmDash 0.34 indexes visible Portable Text prose
  instead of its JSON representation and avoids rewriting the FTS index for
  metadata-only saves. Archives use database limit/offset queries, and
  exhaustive jobs such as the sitemap walk collection cursors.
- Page and post `path` fields and the project `highlight` and `menu_order`
  fields opt into EmDash 0.34's scalar-field indexes because public collection
  queries filter or sort on them. The project content list also shows highlight
  and menu order as native custom columns. These settings live in the seed for
  fresh databases and must be applied through Content Types once on an existing
  deployment because EmDash does not reapply seeds to live schemas.
- EmDash avoids computing taxonomy usage counts during ordinary layout and
  editor prefetches. The project index still requests counts intentionally for
  its topic cloud; EmDash 0.32 drives that aggregate from the taxonomy pivot to
  avoid near-quadratic D1 row reads as the site grows.
- EmDash 0.33 persists manual taxonomy ordering. The upgrade migration keeps
  the existing English term order, and editors can reorder terms afterwards.
  The project topic cloud still applies its deliberate daily shuffle.
- Projects declare EmDash's native `/project/{slug}` collection URL pattern
  instead of persisting an identical imported `path` field. EmDash can
  therefore generate project references and automatic redirects after slug
  changes. The Astro `/projects/{id-or-slug}` compatibility route remains
  because EmDash preview URLs use it and the signed `_preview` query parameter
  must survive the redirect. The legacy root-slug alias also remains; replacing
  either route with one exact redirect row per project would increase cold
  redirect-cache reads on Workers Free.
- The base layout uses `EmDashHead`, `EmDashBodyStart`, and `EmDashBodyEnd` so
  EmDash SEO settings and plugin page contributions are rendered through the
  standard pipeline.
- The sitemap remains site-specific because imported WordPress pages and posts
  use stored nested paths, such as `2022/05/31/post-slug`. EmDash collection URL
  patterns can interpolate an entry slug or ID, but cannot interpolate these
  custom paths. Projects use their native URL pattern in the custom sitemap,
  which still honors EmDash noindex and canonical settings.
- Portable Text images use the EmDash renderer. A narrow CSS compatibility
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
  loaders on the current Cloudflare plan. Audit-log 0.2.0 under-declares the
  capabilities required by its hooks, so `astro.config.mjs` adds
  `content:write` and `media:read`; otherwise EmDash skips the before-save
  snapshot and media-upload hooks. EmDash 0.33 also materializes the plugin's
  storage index instead of scanning the audit table for dashboard queries.
- The upstream embeds plugin registers and renders the enabled YouTube and Vimeo
  blocks directly. Its `astro-embed` dependency is overridden to 0.13.1, which
  is API-compatible with the plugin and declares support for the site's Astro 7
  runtime; the plugin's 0.12 dependency otherwise leaves an invalid peer graph.
- `src/plugins/legacy-content-blocks.ts` preserves edit controls for imported
  WordPress-only Portable Text blocks such as playlist videos, remaining legacy
  embeds, and page lists. Its registered plugin ID remains
  `legacy-image-blocks` for compatibility with existing plugin state.

## Build Compatibility

- `astro.config.mjs` keeps the Vite chunk-size warning limit aligned with the
  admin bundle size while leaving upstream build warnings visible.
- Media uploads retain EmDash 0.34's safer default allowlist, which no longer
  accepts SVG. Site-owned SVG icons remain versioned static assets; user-uploaded
  images use raster formats.
- `wrangler.jsonc` enables Workers Cache with per-deployment version isolation
  and enables Cloudflare logs/traces. A deployment starts with a cold route
  cache; stale entries are not reused across Worker versions.

## Removal Candidates

- Remove the audit-log capability override when a published
  `@emdash-cms/plugin-audit-log` descriptor includes both `content:write` and
  `media:read`. The upstream fix landed after the EmDash 0.34 release, but
  audit-log 0.2.0 is still the published package (tracked by
  [EmDash #1263](https://github.com/emdash-cms/emdash/issues/1263) and
  [PR #1897](https://github.com/emdash-cms/emdash/pull/1897)). Restore direct
  descriptor registration and keep the hook-registration test to confirm
  EmDash no longer skips either hook.
- Remove the `astro-embed` override when the embeds plugin depends on 0.13.1 or
  newer directly.
- Revisit the visual-editing save gate when the upstream toolbar explicitly
  waits for Portable Text saves before publishing or leaving edit mode.
- Remove the local cache-provider wrapper when Wrangler exposes
  `cache.purge()` for its local Workers Cache implementation. Wrangler 4.124
  still lacks it locally.
- Revisit the custom invite route if site email is configured and the default
  EmDash invite flow works with the chosen auth provider. EmDash 0.27 added a
  Cloudflare Email Sending plugin, but that only handles email delivery; this
  site still needs invitees appended to the Cloudflare Access EMAIL list.
