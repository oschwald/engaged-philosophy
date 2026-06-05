# WordPress migration scripts

These scripts are for migration and parity work against the WordPress export and
the local `.migration/seed.json` file. They are not part of the normal runtime
theme surface.

Common commands:

- `pnpm run generate:seed`
- `pnpm run audit:migration`
- `pnpm run audit:legacy-blocks`
- `pnpm run audit:launch-data`
- `pnpm run audit:wordpress-transforms`
- `pnpm run parity:audit`
- `pnpm run sync:seed-d1 -- --local`
- `ALLOW_REMOTE_SEED_SYNC=1 pnpm run sync:seed-d1 -- --remote --confirm remote`

Keep new runtime or theme-maintenance scripts in `scripts/` unless they depend on
the WordPress export, migration seed, or migration-only Portable Text importer.
