# Launch Notes

The site has launched. EmDash/Cloudflare is now the source of truth for content;
do not reimport from WordPress.

## Deployed Verification

1. Run local verification:
   - `pnpm run ci`
2. Deploy the Worker:
   - `pnpm run deploy`
3. Run deployed smoke checks against the canonical hostname:
   - `LIVE_BASE_URL=https://www.engagedphilosophy.com pnpm run smoke:live`
   - `LIVE_BASE_URL=https://www.engagedphilosophy.com pnpm run smoke:live:sitemap`

Use `LIVE_SMOKE_PATH_FILE` with `pnpm run smoke:live` for one-off path lists.

## Post-Launch State

- WordPress migration scripts and parity tooling have been removed.
- Keep `.emdash/seed.json` checked in as the schema/config seed only.
- Keep `seed/seed.json`, `.migration/`, `.snapshot/`, and `.parity-audit/`
  ignored and out of commits.
