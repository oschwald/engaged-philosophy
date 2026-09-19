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
- The public dynamic-page rate limit is 10 requests per 10 seconds per IP and
  Cloudflare location. It excludes verified bots, `/_emdash`, `/_astro`, the
  image endpoint, and paths with file extensions. Full-sitemap smoke checks run
  sequentially with a 1.25-second delay so they remain below this limit.

Install the stateful-cookie bypass Cache Rule before deploying code that omits
`Vary: Cookie`. Set `CACHE_STATEFUL_COOKIE_BYPASS_ACTIVE` to `"true"` only
after validating that rule. The default retains cookie variance, so preview,
local, and incompletely configured production deployments fail safely.

### Edge rejection and Worker fallbacks

The deployed custom rules use these expressions, in order, with action Block:

| Expression                                                       | Purpose                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [scanner-rule.txt](../cloudflare/scanner-rule.txt)               | Credential/configuration probes, obsolete framework endpoints, and the explicit crawler denylist |
| [php-upload-rule.txt](../cloudflare/php-upload-rule.txt)         | PHP scripts, backup/version suffixes, and known upload exploits                                  |
| [public-request-rule.txt](../cloudflare/public-request-rule.txt) | Unsupported public methods and oversized URLs                                                    |

All three scope requests to apex/www. Path comparisons decode percent escapes
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

Worker preview URLs remain enabled and share production bindings, but the
site's zone WAF does not cover them. The cheap Worker scanner/crawler checks
protect those entrypoints and requests exempted by the verified-bot rules.
The Worker also handles exact Unicode/path-segment limits, malformed encoding,
and uncommon multi-digit PHP suffixes that the Free-plan WAF expressions do
not reproduce. Preview authorization, search/cursor validation, and deciding
whether a content path exists remain application responsibilities.

## Usage Review

Review three complete UTC days after a cache or bot-policy deployment. Use
these investigation thresholds rather than treating them as additional hard
limits:

- KV writes: investigate above 500 per day or 100 in one hour.
- D1 rows read: investigate above 2.5 million per day.
- Worker requests: investigate above 50,000 per day.
- R2, logs, and traces: investigate when the Cloudflare dashboard reports 50%
  of the applicable monthly or daily allowance.

Keep roughly 14 days of `_emdash_404_log` diagnostic history. Prune older rows
with EmDash's supported 404-log management operation when reviewing usage; the
table-wide cap check runs after each recorded 404, so shorter useful retention
also bounds D1 row reads from scanner misses.

Keep Workers trace sampling at 5% unless measured observability events approach
their allowance. Exhausting the logs or traces allowance reduces diagnostics;
it is not a reason to trade away useful production evidence preemptively.

If KV writes remain unsafe after edge and request-policy changes, test EmDash's
supported bounded in-isolate `memoryCache()` backend in a separate deployment.
Do not parse or filter EmDash's serialized cache values in site code.
