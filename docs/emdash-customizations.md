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
- `src/lib/anonymous-cloudflare-cache.ts` caches anonymous HTML page responses in
  the Workers Cache API while bypassing signed-in, preview, admin, API, and
  static-asset requests.
- `src/worker.ts` logs selected admin/signed-in request metadata and slow
  observed requests without serializing cookie values.

### Cloudflare Access Invites

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
- `src/plugins/embeds.ts` registers YouTube and Vimeo editor blocks while using
  the upstream embed renderer.
- `src/plugins/legacy-image-blocks.ts` preserves edit controls for imported
  WordPress-only Portable Text blocks such as floated images, playlist videos,
  legacy embeds, and page lists.

## Build Compatibility

- `astro.config.mjs` suppresses known upstream build warnings and aliases
  `@astrojs/internal-helpers/create-filter` for current dependency
  compatibility.
- `wrangler.jsonc` enables Cloudflare logs/traces and includes both current and
  legacy binding names for D1/R2 compatibility.

## Removal Candidates

- After launch and final WordPress import, delete `scripts/migration/**` and the
  migration-only dev dependencies. See `docs/launch-checklist.md` for the final
  import and cleanup sequence.
- Revisit the audit-log native adapter if Cloudflare sandbox support becomes
  available or the upstream plugin ships a native/free-plan mode.
- Revisit the custom invite route if site email is configured and the default
  EmDash invite flow works with the chosen auth provider.
