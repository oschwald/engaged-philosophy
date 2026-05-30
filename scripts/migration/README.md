# WordPress migration scripts

These scripts are for migration and parity work against the WordPress export and
the local `.migration/seed.json` file. They are not part of the normal runtime
theme surface.

Common commands:

- `npm run generate:seed`
- `npm run audit:migration`
- `npm run parity:audit`
- `npm run sync:seed-d1 -- --local`
- `npm run sync:seed-d1 -- --remote --confirm remote`

Keep new runtime or theme-maintenance scripts in `scripts/` unless they depend on
the WordPress export, migration seed, or migration-only Portable Text importer.
