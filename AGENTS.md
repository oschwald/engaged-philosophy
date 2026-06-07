# Repository Guidelines

## Project Structure & Module Organization

This is an Astro + EmDash site deployed to Cloudflare Workers. Runtime source
lives in `src/`, with pages in `src/pages/`, shared components in
`src/components/`, Sass in `src/scss/`, and custom browser scripts in `src/js/`.
Custom EmDash plugins live under `src/plugins/`. Public static assets are in
`public/`. Migration-only WordPress tooling is isolated in `scripts/migration/`
and should not be expanded for normal runtime work. Documentation lives in
`docs/`. Tests are split between `tests/` for Vitest, `e2e-static/` for browser
fixtures without a Worker, and `e2e/` for Worker-backed Playwright workflows.

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
typechecks, build, Worker smoke checks, and Worker-backed e2e tests. Use
`pnpm run smoke:live` or `pnpm run smoke:live:wordpress` for deployed checks.

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

## Commit & Pull Request Guidelines

Follow the existing commit style: `chore: switch to pnpm and mise`,
`test: cover legacy image block editing`, `docs: ...`, `cache: ...`. Keep each
commit scoped to one fix type. PRs should describe behavior changes, list test
commands run, link related issues, and include screenshots for visible UI
changes.

## Security & Configuration Tips

Do not commit secrets, Cloudflare tokens, generated migration data, or local
exports. Keep `seed/seed.json`, `.migration/`, `.wrangler/`, `dist/`, and
Playwright reports out of commits. Add runtime tools to `mise.toml` so CI and
local environments stay aligned; update `mise.lock` with tool changes.
