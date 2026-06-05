# Launch Checklist

Use this checklist for the final WordPress cutover. Before launch, the
WordPress export remains the source of truth for migrated content. After launch,
EmDash/Cloudflare becomes the source of truth and the migration-only code should
be removed.

## Final Import

1. Export WordPress content from the live WordPress site.
2. Run the migration pipeline against that export:
   - `pnpm run generate:seed`
   - `pnpm run migrate:media`
   - `pnpm run migrate:importer-schema`
   - `pnpm run migrate:portable-text`
   - `pnpm run migrate:derived-path-fields`
3. Sync the generated migration seed to production D1:
   - `ALLOW_REMOTE_SEED_SYNC=1 pnpm run sync:seed-d1 -- --remote --confirm remote`
4. Run migration and parity checks:
   - `pnpm run audit:migration`
   - `pnpm run audit:legacy-blocks`
   - `pnpm run audit:legacy-media`
   - `pnpm run audit:launch-data`
   - `pnpm run audit:wordpress-transforms`
   - `pnpm run parity:audit`

## Launch Verification

1. Run local verification:
   - `pnpm run ci`
2. Deploy the Worker:
   - `pnpm run deploy`
3. Run deployed smoke checks:
   - `LIVE_BASE_URL=https://engaged-philosophy.ramona75.workers.dev pnpm run smoke:live`
4. Run the full migrated public-path smoke check against staging:
   - `LIVE_BASE_URL=https://engaged-philosophy.ramona75.workers.dev pnpm run smoke:live:wordpress`
5. If the canonical hostname has already moved, run the smoke checks there too:
   - `LIVE_BASE_URL=https://www.engagedphilosophy.com pnpm run smoke:live`
   - `LIVE_BASE_URL=https://www.engagedphilosophy.com pnpm run smoke:live:wordpress`

## Post-Launch Cleanup

After launch, do not reimport WordPress content. Remove the migration-only
surface in a dedicated cleanup branch:

- Delete `scripts/migration/**`.
- Remove migration-only package scripts from `package.json`.
- Remove migration-only dev dependencies that are no longer referenced:
  `cheerio`, `pixelmatch`, `pngjs`, `turndown`, and `turndown-plugin-gfm`.
- Keep `.emdash/seed.json` checked in as the schema/config seed only.
- Keep `seed/seed.json`, `.migration/`, `.snapshot/`, and `.parity-audit/`
  ignored and out of commits.

Before merging that cleanup, confirm runtime code is independent of the deleted
importer:

```sh
rg "scripts/migration|migration/" src astro.config.mjs wrangler.jsonc package.json
pnpm run test:seed
pnpm run ci
```
