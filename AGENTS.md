# Repository Guidelines

## Project Structure & Module Organization

This is an Astro + EmDash site deployed to Cloudflare Workers. Runtime source
lives in `src/`, with pages in `src/pages/`, shared components in
`src/components/`, Sass in `src/scss/`, and custom browser scripts in `src/js/`.
Custom EmDash plugins live under `src/plugins/`. Public static assets are in
`public/`. Documentation lives in `docs/`. Tests are split between `tests/` for
Vitest, `e2e-static/` for browser fixtures without a Worker, and `e2e/` for
Worker-backed Playwright workflows.

## Build, Test, and Development Commands

Use mise and pnpm:

```sh
mise install
pnpm install --frozen-lockfile
pnpm run dev
pnpm run build
pnpm run ci
```

If your shell is not mise-activated, prefix commands with `mise exec --`, for
example `mise exec -- pnpm run ci`.

`pnpm run dev` starts Astro locally. `pnpm run build` runs the seed guard and
builds the Worker output. `pnpm run ci` runs linting, unit/static tests,
generated-type verification, app and test typechecks, build, Worker smoke
checks, and Worker-backed e2e tests. Use `pnpm run smoke:live` or
`pnpm run smoke:live:sitemap` for deployed checks.

## Dependency Updates

Update `emdash`, `@emdash-cms/auth`, and `@emdash-cms/cloudflare` together.
Check peer ranges before upgrading toolchain majors, especially TypeScript
against Astro Check and typescript-eslint. Review existing overrides against
their dependents' requirements; a global override can force an incompatible
major into an unrelated dependency. Keep release-age exceptions in
`pnpm-workspace.yaml` scoped to reviewed package versions.

Add runtime tools to `mise.toml` and update `mise.lock` when tool versions change.
Keep Node and pnpm pins aligned with `package.json`'s `engines` and
`packageManager`. See [EmDash customizations](docs/emdash-customizations.md) for
current compatibility constraints and reasons for local workarounds.

## Schema & Generated Types

`.emdash/seed.json` is the checked-in schema/config seed; keep content exports
out of it. Seed changes initialize fresh databases and do not migrate an
existing deployment's schema.

After schema or EmDash changes, regenerate `emdash-env.d.ts` with `pnpm run dev`
using `EMDASH_TYPES_CHECK_STATE` set to a fresh temporary directory, so generation
uses the seed schema instead of existing local data. Stop the server after
generation, include changed declarations in the same commit, and verify with
`pnpm run check:emdash-types`. That check restores the original declarations;
it does not save regenerated output.

## Coding Style & Naming Conventions

The repo uses Prettier and ESLint. Use tabs where the formatter emits them, keep
files ASCII unless existing content requires otherwise, and prefer existing
Astro/TypeScript patterns over new abstractions. Name tests by behavior, not
implementation detail, for example `legacy-image-editing.spec.ts`.

## Testing Guidelines

Put pure transforms and configuration guards in `tests/`. Put browser behavior
that does not need Cloudflare bindings in `e2e-static/`. Put admin, public site,
media, cache, and visual editing workflows in `e2e/`. Run focused commands while
working, then `pnpm run ci` before handing off larger changes.

If no supported browser is installed, run
`pnpm exec playwright install --with-deps chromium`. Worker-backed tests rebuild
`dist/` with test auth, including when run through `pnpm run ci`. Run a normal
`pnpm run build` with test-auth flags unset before Worker bundle/runtime smoke
checks or deployment; `pnpm run deploy` already rebuilds. See [Testing](docs/testing.md)
for test layers and the limits of local cache validation.

## Commit & Pull Request Guidelines

Follow the existing commit style: `chore: switch to pnpm and mise`,
`test: cover legacy image block editing`, `docs: ...`, `cache: ...`. Keep each
commit scoped to one fix type. PRs should describe behavior changes, list test
commands run, link related issues, and include screenshots for visible UI
changes.

## Documentation Guidelines

Keep checked-in documentation relevant to ongoing development and operation of
the site. Update existing guides when behavior or procedures change. Put
release-specific upgrade reviews, task summaries, validation results, and
one-time rollout notes in PR descriptions or issues. Do not check them into
repository documentation. Preserve lasting guidance in the appropriate
existing guide.

## Security & Configuration Tips

Do not commit secrets, Cloudflare tokens, generated migration data, or local
exports. Keep `seed/seed.json`, `.migration/`, `.wrangler/`, `dist/`, and
Playwright reports out of commits, along with the generated
`.emdash/migrations.json` manifest. The live site runs on Cloudflare Workers
Free, so keep new Worker features within Free request/CPU limits and avoid
paid-only features unless the account plan is explicitly changed.

Current branch/commit previews share production bindings, and their runtime
migrations can write to the live database even on read requests. See
[Branch Previews](docs/testing.md#branch-previews) before using them for testing.
