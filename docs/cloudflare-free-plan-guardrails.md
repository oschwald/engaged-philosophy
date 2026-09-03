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

- Verified bots are excluded from scanner and rate-limit rules.
- `media.engagedphilosophy.com/wp-content/uploads/` remains reachable because
  it contains legitimate migrated media.
- Requests carrying any stateful cookie named in
  `src/lib/request-state.ts` bypass the shared HTML cache.
- `/_emdash`, `_preview`, `_edit`, and search-result requests are never folded
  into anonymous cache entries.
- Query strings may be ignored in the cache key only where the application
  does not use them to render a different response.
- The public dynamic-page rate limit is 10 requests per 10 seconds per IP and
  Cloudflare location. It excludes verified bots, `/_emdash`, `/_astro`, the
  image endpoint, and paths with file extensions. Full-sitemap smoke checks run
  sequentially with a 1.25-second delay so they remain below this limit.

Install the stateful-cookie bypass Cache Rule before deploying code that omits
`Vary: Cookie`. Set `CACHE_STATEFUL_COOKIE_BYPASS_ACTIVE` to `"true"` only
after validating that rule. The default retains cookie variance, so preview,
local, and incompletely configured production deployments fail safely.

## Usage Review

Review three complete UTC days after a cache or bot-policy deployment. Use
these investigation thresholds rather than treating them as additional hard
limits:

- KV writes: investigate above 500 per day or 100 in one hour.
- D1 rows read: investigate above 2.5 million per day.
- Worker requests: investigate above 50,000 per day.
- R2, logs, and traces: investigate when the Cloudflare dashboard reports 50%
  of the applicable monthly or daily allowance.

Keep Workers trace sampling at 5% unless measured observability events approach
their allowance. Exhausting the logs or traces allowance reduces diagnostics;
it is not a reason to trade away useful production evidence preemptively.

If KV writes remain unsafe after edge and request-policy changes, test EmDash's
supported bounded in-isolate `memoryCache()` backend in a separate deployment.
Do not parse or filter EmDash's serialized cache values in site code.
