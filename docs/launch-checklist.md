# Launch Checklist

Use this checklist for the final WordPress cutover. Before launch, the
WordPress export remains the source of truth for migrated content. After launch,
EmDash/Cloudflare becomes the source of truth and the migration-only code should
be removed.

## Final Import

1. Export WordPress content from the live WordPress site.
2. Run the migration pipeline against that export:
   - `npm run generate:seed`
   - `npm run migrate:media`
   - `npm run migrate:importer-schema`
   - `npm run migrate:portable-text`
   - `npm run migrate:derived-path-fields`
3. Sync the generated migration seed to production D1:
   - `ALLOW_REMOTE_SEED_SYNC=1 npm run sync:seed-d1 -- --remote --confirm remote`
4. Run migration and parity checks:
   - `npm run audit:migration`
   - `npm run audit:legacy-blocks`
   - `npm run audit:legacy-media`
   - `npm run audit:launch-data`
   - `npm run audit:wordpress-transforms`
   - `npm run parity:audit`

## Launch Verification

1. Run local verification:
   - `npm run ci`
2. Deploy the Worker:
   - `npm run deploy`
3. Run deployed smoke checks:
   - `LIVE_BASE_URL=https://engaged-philosophy.ramona75.workers.dev npm run smoke:live`
4. Run the full migrated public-path smoke check against staging:
   - `LIVE_BASE_URL=https://engaged-philosophy.ramona75.workers.dev npm run smoke:live:wordpress`
5. If the canonical hostname has already moved, run the smoke checks there too:
   - `LIVE_BASE_URL=https://www.engagedphilosophy.com npm run smoke:live`
   - `LIVE_BASE_URL=https://www.engagedphilosophy.com npm run smoke:live:wordpress`

## Post-Launch Cleanup

After launch, do not reimport WordPress content. Remove the migration-only
surface in a dedicated cleanup branch:

- Delete `scripts/migration/**`.
- Remove migration-only npm scripts from `package.json`.
- Remove migration-only dev dependencies that are no longer referenced:
  `cheerio`, `pixelmatch`, `pngjs`, `turndown`, and `turndown-plugin-gfm`.
- Keep `.emdash/seed.json` checked in as the schema/config seed only.
- Keep `seed/seed.json`, `.migration/`, `.snapshot/`, and `.parity-audit/`
  ignored and out of commits.

Before merging that cleanup, confirm runtime code is independent of the deleted
importer:

```sh
rg "scripts/migration|migration/" src astro.config.mjs wrangler.jsonc package.json
npm run test:seed
npm run ci
```
