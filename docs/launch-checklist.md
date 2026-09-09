# Launch Notes

The site has launched. EmDash/Cloudflare is now the source of truth for content;
do not reimport from WordPress.

## Deployed Verification

1. Run local verification:
   - `pnpm run ci`
2. Deploy the Worker:
   - `pnpm run deploy`
3. After the EmDash 0.37 deploy, verify that the admin dashboard reports a
   healthy scheduler heartbeat and that migration
   `074_content_deleted_scheduled_index` has completed. Open **Settings ->
   Media usage tracking**, enable tracking if needed, and keep the page open
   until it reports **Ready**.
4. Run deployed smoke checks against the canonical hostname:
   - `LIVE_BASE_URL=https://www.engagedphilosophy.com pnpm run smoke:live`
   - `LIVE_BASE_URL=https://www.engagedphilosophy.com pnpm run smoke:live:sitemap`

Use `LIVE_SMOKE_PATH_FILE` with `pnpm run smoke:live` for one-off path lists.

## Media Editing

Use a cropped copy when the original should remain available. Replacing an
original preserves its media ID and URL but overwrites its bytes without
keeping history. EmDash writes revalidation metadata on replacements, but
does not purge existing CDN entries on the site's separate public media
hostname or copies already cached by browsers. Check that delivery path and
purge the affected CDN URL if immediate visibility is needed. Existing browser
copies may still require revalidation; use a new copy and URL when that delay
is unacceptable.

Saved legacy display dimensions do not automatically follow a replacement's
new aspect ratio. Check affected pages after cropping or replacing an image.
Public media continues to use direct R2 delivery; Astro's existing default
`IMAGES` binding is adapter-managed.

## MCP Content Changes

EmDash's `content_update`, `content_publish`, `content_unpublish`, and
`content_discard_draft` MCP tools require `_rev`. Read with `content_get`, pass
the token back unchanged, and reread/reconcile after a conflict. Repository
automation does not currently call these tools.

## Post-Migration Maintenance

After a direct content migration or bulk content rewrite that bypasses the
EmDash content API, open **Settings -> Media usage tracking** and keep the page
open until the bounded, resumable scan reports **Ready**. EmDash 0.36 no longer
runs Media Usage reconciliation from a dedicated Cron Trigger.

The explicit `emdash media repair-usage` command is now a recovery tool rather
than a routine post-migration step. Use it only when automatic reconciliation
reports failed work that cannot be retried from the admin.

## Legacy Schema Follow-up

The checked-in seed enables indexes for the page and post `path` fields and the
project `highlight` and `menu_order` fields, and shows the two project fields as
admin list columns. A seed initializes fresh databases only. If the existing
site skipped the EmDash 0.34 schema follow-up, apply those same settings once
under **Content Types**; the public queries remain compatible while this
metadata is being updated.

## Post-Launch State

- WordPress migration scripts and parity tooling have been removed.
- Keep `.emdash/seed.json` checked in as the schema/config seed only.
- Keep `seed/seed.json`, `.migration/`, `.snapshot/`, and `.parity-audit/`
  ignored and out of commits.
