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

## Post-Migration Maintenance

After a direct content migration or bulk content rewrite that bypasses the
EmDash content API, authenticate through Cloudflare Access and rebuild
EmDash's media usage index:

```sh
cloudflared access login https://www.engagedphilosophy.com/_emdash/
emdash_access_jwt="$(
  cloudflared access token \
    --app https://www.engagedphilosophy.com/_emdash/
)"
export EMDASH_HEADERS="Cf-Access-Token: ${emdash_access_jwt}"
pnpm exec emdash media repair-usage --all \
  --url https://www.engagedphilosophy.com \
  --json
unset EMDASH_HEADERS emdash_access_jwt
```

This site's Cloudflare Access authenticator does not expose EmDash OAuth Device
Flow, so `emdash login` cannot create a stored CLI session.

For noninteractive use with an approved Access service token, read the
credentials without echoing or placing them in shell history, then provide the
two standard headers through EmDash's environment variable:

```sh
read -r -p "Cloudflare Access client ID: " emdash_access_client_id
read -r -s -p "Cloudflare Access client secret: " emdash_access_client_secret
printf "\n"
export EMDASH_HEADERS="$(
  printf "CF-Access-Client-Id: %s\nCF-Access-Client-Secret: %s" \
    "${emdash_access_client_id}" \
    "${emdash_access_client_secret}"
)"
# Run the same pnpm exec emdash media repair-usage command shown above.
unset EMDASH_HEADERS emdash_access_client_id emdash_access_client_secret
```

Treat the repair as successful only when the JSON result reports
`"status": "complete"`, every collection is complete, and
`failedSourceCount` is zero. Rerun the repair after any later migration that
changes media references.

## Post-Launch State

- WordPress migration scripts and parity tooling have been removed.
- Keep `.emdash/seed.json` checked in as the schema/config seed only.
- Keep `seed/seed.json`, `.migration/`, `.snapshot/`, and `.parity-audit/`
  ignored and out of commits.
