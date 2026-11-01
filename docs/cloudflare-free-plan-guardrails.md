# Cloudflare Free Plan Guardrails

The public site uses three layers to keep anonymous traffic from consuming
Workers Free quotas:

1. Cloudflare WAF and rate limiting reject abusive traffic before it counts as
   a Worker invocation.
2. Workers Caching serves anonymous HTML without running application code.
3. The outer Worker rejects or normalizes requests before Astro, EmDash, KV, or
   D1 work begins on a cache miss.

## Production Rules

The zone rules for `engagedphilosophy.com` must preserve these invariants:

- Verified bots are excluded from generic scanner and rate-limit rules. The
  explicit `MJ12bot` and `VelenPublicWebCrawler` denylist applies regardless
  of verified-bot status, matching the site's crawler policy.
- `media.engagedphilosophy.com/wp-content/uploads/` remains reachable because
  it contains legitimate migrated media.
- Requests carrying any stateful cookie named in
  `src/lib/request-state.ts` bypass the shared HTML cache.
- `/_emdash`, `_preview`, `_edit`, and search-result requests are never folded
  into anonymous cache entries.
- Query strings may be ignored in the cache key only where the application
  does not use them to render a different response.
- Known PHP, credential, environment, GraphQL, WordPress-installation, and
  upload-exploit probes are rejected by zone WAF rules before the Worker runs.
  The Worker retains a fallback for requests outside that coverage. Keep
  legitimate legacy content and `wp-content/uploads` paths out of this list.
- The public rate limit is 10 requests per 10 seconds per IP and Cloudflare
  location. [public-rate-limit-rule.txt](../cloudflare/public-rate-limit-rule.txt)
  excludes verified bots, EmDash, Astro assets, image optimization, `/img/logo.png`,
  favicon/robots/manifest endpoints, `.well-known`, and `cdn-cgi`.
  Other paths count even when they have a file extension, including missing paths
  under `/img/` and `/wp-content/uploads/` on apex/www. Uploaded media uses the
  separate media hostname, outside this rule. Full-sitemap smoke checks run
  sequentially with a 1.25-second delay so they remain below this limit.
  The Free-plan rate-limit expression uses path matching without `url_decode`.
  Credential-probe custom rules and the Worker fallback decode percent escapes.

Install the stateful-cookie bypass Cache Rule before deploying code that omits
`Vary: Cookie`. Set `CACHE_STATEFUL_COOKIE_BYPASS_ACTIVE` to `"true"` only
after validating that rule. The default retains cookie variance, so preview,
local, and incompletely configured production deployments fail safely.

### Edge rejection and Worker fallbacks

The deployed custom rules use these expressions, in order, with action Block:

| Expression                                                           | Purpose                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [scanner-rule.txt](../cloudflare/scanner-rule.txt)                   | Credential/configuration probes, obsolete framework endpoints, and the explicit crawler denylist |
| [php-upload-rule.txt](../cloudflare/php-upload-rule.txt)             | PHP scripts, backup/version suffixes, and known upload exploits                                  |
| [public-request-rule.txt](../cloudflare/public-request-rule.txt)     | Unsupported public methods and oversized URLs                                                    |
| [credential-probe-rule.txt](../cloudflare/credential-probe-rule.txt) | Root configuration files, Vault and container secrets, and credential probes                     |

All four scope requests to apex/www. Path comparisons decode percent escapes
and respect component boundaries; a legitimate `environment.php.jpg` is not
a PHP script. EmDash API and image-optimization endpoints are exempt from the
generic path and method checks. The media hostname is outside these rules.
The explicit crawler denylist also covers admin and image requests.

Wrangler deployments do not install these zone rules. When changing an
expression, save the current ruleset for rollback and validate the replacement
with the Rulesets API's `dry_run=true` option before applying it. Use Cloudflare
Trace with `skip_response: true` to test custom-rule matches without invoking
the Worker, then run `smoke:live`. Trace also reports rate-limit expression
matches; those are separate from the custom-rule block assertions.

Worker preview URLs remain enabled. Old Version URLs share production bindings.
Native previews use separate shared staging bindings after the deliberate
[Builds switch](testing.md#one-time-activation). The site's zone WAF does not cover
preview hostnames. The cheap Worker scanner/crawler checks
protect those entrypoints and requests exempted by the verified-bot rules.
The Worker also handles exact Unicode/path-segment limits, malformed encoding,
and uncommon multi-digit PHP suffixes that the Free-plan WAF expressions do
not reproduce. Preview authorization, search/cursor validation, and deciding
whether a content path exists remain application responsibilities.

## Public Query Indexes

The site-owned D1 migrations in `migrations/` supplement EmDash's schema:

- `idx_ep_posts_recent` matches the published-post filter and date/title/ID
  ordering used by the sidebar and feed. D1 can stop after the requested rows
  instead of sorting the collection and loading related data for discarded rows.
- `idx_ep_options_name_nocase` supports EmDash's `LIKE 'site:%'` settings lookup.
  Its collation preserves the existing case-insensitive prefix matching.

These indexes add storage and index writes when their indexed values change.
They do not change content, query results, or cache invalidation.

Worker deployments do not apply these migrations. Initialize EmDash and the
site's content types before applying them to a fresh database. Wrangler records
them in `d1_migrations`, separately from EmDash's core migrations.

From the repository root, authenticate to the account containing the site's
databases. Apply pending migrations to the initialized staging database first:

```sh
pnpm exec wrangler d1 migrations apply engaged-philosophy-preview --remote --config wrangler.jsonc
```

After checking staging, apply the same migrations to production:

```sh
pnpm exec wrangler d1 migrations apply engaged-philosophy --remote --config wrangler.jsonc
```

The explicit database names select the target. Do not use old Version URLs to
initialize staging, because those URLs share production bindings. See
[Branch Previews](testing.md#branch-previews).

Confirm the indexes exist and inspect `EXPLAIN QUERY PLAN` for the current
recent-posts and settings queries. Repeat this check after EmDash schema
upgrades. Compare D1 rows read using the usage-review procedure below.

## Usage Review

The public 404 template keeps search and navigation but omits the recent-posts
sidebar. Missing paths must not load a post collection. They still incur CMS
routing and layout queries. Do not cache arbitrary 404s without publication
invalidation, because a newly published page must become visible immediately.
The missing-page tests cover the response layout, bound query counts, and inspect
SQL logs through body streaming to reject post-collection queries.
The scanner policy also rejects known probes before EmDash runs.

Review three complete UTC days after a cache or bot-policy deployment. Use
these investigation thresholds rather than treating them as additional hard
limits:

- KV writes: investigate above 500 per day or 100 in one hour.
- D1 rows read: investigate above 2.5 million per day.
- Worker requests: investigate above 50,000 per day.
- R2, logs, and traces: investigate when the Cloudflare dashboard reports 50%
  of the applicable monthly or daily allowance.

EmDash records 404s without counting or trimming the log on public requests.
EmDash 1.2 runs system cleanup at the top of the hour. Its 404-log cap check
counts at most 10,001 rows and deletes older paths only above the 10,000-path
cap. The log can exceed that count between cleanup runs. Keep the five-minute
scheduler trigger, including minute zero, and monitor its failures. Publication
polling still runs every five minutes. Request-policy and WAF checks prevent
scanner traffic from reaching the CMS in the first place.

Keep Workers trace sampling at 5% unless measured observability events approach
their allowance. Exhausting the logs or traces allowance reduces diagnostics;
it is not a reason to trade away useful production evidence preemptively.

If KV writes remain unsafe after edge and request-policy changes, test EmDash's
supported bounded in-isolate `memoryCache()` backend in a separate deployment.
Do not parse or filter EmDash's serialized cache values in site code.

Use `scripts/measure-kv-usage.mjs` for representative local query counts and
TTFB/full-response timings. A query count is not a count of D1 rows read. KV
key growth does not measure read/write operations, and local wall time is not
Worker CPU. For production evidence, record the same UTC interval and deployed
version in the PR or issue. Compare Worker request/CPU metrics, D1 rows read and
written, and KV read/write totals in Cloudflare Analytics against the prior
interval. Account for traffic volume and exclude snapshot/import or admin work
from public-request comparisons. Inspect sampled Worker traces for slow routes
and keep the existing production edge-hit smoke check. Do not infer billed
operation counts from local cache keys or extrapolate fixture timings as CPU.
