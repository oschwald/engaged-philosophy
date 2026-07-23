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
  local Wrangler does not expose `cache.purge()`.
- Public responses are fresh at the edge for one day and may be served stale
  for one hour while they revalidate. Browsers receive `max-age=0` and
  revalidate instead of retaining HTML or generated metadata independently.
  Cookie-bearing and query-string HTML responses are `no-store`; public HTML
  varies on `Cookie` so a cached anonymous response cannot hide that bypass.
- Page cache tags describe the content entry, collection lists, site settings,
  primary menu, and taxonomy data actually rendered. EmDash already invalidates
  entry and collection tags. Site middleware adds settings, primary-menu, and
  taxonomy invalidation, batching every affected tag into one purge request.
  This keeps the additional purge load small on Workers Free.
- `src/js/emdash-save-gate.js` makes the visual-editing Publish and edit-mode
  controls wait for pending inline saves. EmDash 0.30 flushes edits when the
  browser navigates away, but its toolbar can still publish before a Portable
  Text blur save finishes. The gate also ignores redundant keepalive saves when
  EmDash reports no unsaved changes, while retaining the unload protection for
  real edits.
- `src/worker.ts` logs selected admin/signed-in request metadata and slow
  observed requests without serializing cookie values.

EmDash 0.30's backup page works with the existing R2 storage adapter and
scheduled Worker handler. Administrators can enable daily archives under
Settings -> Backups; archives contain content and media metadata, not media
binaries, user accounts, or secrets.

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
- Search uses EmDash full-text search, then batch-hydrates only the entries on
  the current result page. Archives use database limit/offset queries, and
  exhaustive jobs such as the sitemap walk collection cursors.
- The base layout uses `EmDashHead`, `EmDashBodyStart`, and `EmDashBodyEnd` so
  EmDash SEO settings and plugin page contributions are rendered through the
  standard pipeline.
- The sitemap remains site-specific because imported WordPress posts use a
  stored `path` such as `2022/05/31/post-slug`. EmDash collection URL patterns
  can interpolate an entry slug or ID, but cannot interpolate this custom path.
  The custom sitemap still honors EmDash noindex and canonical settings.
- Current Portable Text image and gallery nodes use the EmDash renderers.
  Legacy renderers remain only for imported WordPress alignment, link, gallery,
  and media shapes that do not have direct EmDash equivalents.

## Imported Field Names

EmDash system properties use camelCase (`createdAt`, `updatedAt`, and
`publishedAt`). Imported WordPress fields retain their persisted schema slugs,
which use snake_case (`published_on`, `featured_image`, `author_name`, and
`menu_order`). These names are database and admin-schema identifiers, not a
style choice in new application code. New application-facing APIs should use
camelCase and keep legacy names inside content adapters. Renaming a persisted
field requires a backup-backed content/schema migration and should be handled
separately from routine refactoring.

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

- `src/plugins/audit-log.ts` adapts the audit-log plugin's sandbox definition to
  native hooks/routes so it can run on the current Cloudflare plan.
- The upstream embeds plugin registers and renders the enabled YouTube and Vimeo
  blocks directly.
- `src/plugins/legacy-image-blocks.ts` preserves edit controls for imported
  WordPress-only Portable Text blocks such as floated images, playlist videos,
  legacy embeds, and page lists.

## Build Compatibility

- `astro.config.mjs` keeps the Vite chunk-size warning limit aligned with the
  admin bundle size while leaving upstream build warnings visible.
- `wrangler.jsonc` enables Workers Cache with per-deployment version isolation,
  enables Cloudflare logs/traces, and includes both current and legacy binding
  names for D1/R2 compatibility. A deployment starts with a cold route cache;
  stale entries are not reused across Worker versions.

## Removal Candidates

- Revisit the audit-log native adapter if Cloudflare sandbox support becomes
  available or the upstream plugin ships a native/free-plan mode.
- Revisit the visual-editing save gate when the upstream toolbar explicitly
  waits for Portable Text saves before publishing or leaving edit mode.
- Remove the local cache-provider wrapper when Wrangler exposes
  `cache.purge()` for its local Workers Cache implementation.
- Revisit the custom invite route if site email is configured and the default
  EmDash invite flow works with the chosen auth provider. EmDash 0.27 added a
  Cloudflare Email Sending plugin, but that only handles email delivery; this
  site still needs invitees appended to the Cloudflare Access EMAIL list.
