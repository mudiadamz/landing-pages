---
name: product-campaign-analysis
description: >-
  Diagnose a live ad campaign for the ADM.UIUX marketplace using first-party
  analytics: is the traffic converting, and if not, why. Separates technical
  delivery problems (slow preview, blocking payloads, bad region) from UX and
  creative problems (weak hook, high bounce, broken funnel, wrong price band)
  from timing problems, then returns a ranked list of fixes. Use when the user
  asks how an ad/campaign is doing, why a product isn't converting, why bounce
  rate is high, where visitors drop off, whether to keep spending, or wants
  weaknesses and recommendations for a running product.
---

# Product Campaign Analysis

You diagnose **live campaigns** for **ADM.UIUX** — an Indonesian marketplace of
digital products (ebooks, indie novels, HTML templates, digital assets).

The other two skills cover different stages: `product-launch-brainstorm`
generates ideas, `product-launch-scout` scores one before launch. **This one runs
after money is being spent** — it answers "is this working, and if not, what
exactly is broken?"

## The rule that matters most

> **Measure the technical delivery before blaming the creative.**

The most expensive failure this project has seen looked exactly like a bad
product: an Instagram campaign delivering real, well-targeted traffic where 81%
of visitors left within 8 seconds. The owner concluded the *timing* was wrong.
It wasn't. The preview downloaded, unzipped and parsed a 3.42 MB EPUB in the
browser before rendering a single word — roughly **7 seconds of blank screen** on
typical Indonesian 4G. The text was only 61 KB; two PNGs were the rest.

Ads were fine. Targeting was fine. The product may well have been fine. A
loading spinner ate the budget.

So: **never** conclude "weak hook" or "wrong audience" until you have measured
time-to-first-content on a real URL. Bounce under ~8s is as often an engineering
bug as a creative one.

## Business context (assume unless told otherwise)

- Audience: **Indonesian**, overwhelmingly **mobile**, price-sensitive, pays via
  Duitku (QRIS/e-wallet). Traffic arrives largely from **Instagram/Facebook ads**.
- Proven price band is low (historically ~Rp25.000 converts; higher asks have
  not). Always check the actual purchase history before accepting a price.
- Spending rhythm: **payday (`gajian`) ~tanggal 25 & 1**, Harbolnas 9.9/10.10/
  11.11/12.12, Ramadan/Idul Fitri, Natal/Tahun Baru, 17 Agustus.
- Instagram's in-app browser cannot install a PWA and behaves differently from
  Safari/Chrome — relevant when judging mobile behaviour.

## Step 1 — Pull the first-party data

Query Supabase directly with the service-role key. This pattern works:

```bash
node --env-file=.env.local -e '
const { createClient } = require("@supabase/supabase-js");
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => { /* queries here */ })();'
```

Tables that matter:

| Table | Use it for |
|---|---|
| `lp_sessions` | one row per visit: `utm_*`, `referrer_host`, `ip`, `country/city`, `device/browser/os`, `landing_path`, `pageviews`, `active_ms`, `started_at` |
| `lp_page_events` | the journey: `path`, `page_type` (home/preview/checkout/panel), `product_slug`, `dwell_ms`, `scroll_depth`, `reached_end`, `engagement` (left/curious/read) |
| `lp_purchases` | conversions: `landing_page_id`, `amount`, `payment_method`, `purchased_at`, `bundle_parent_id` |
| `lp_landing_pages` | the product: `price`, `price_discount`, `is_free`, `preview_type`, `preview_url`, `story_epub_url`, `next_product_id`, `bundle_product_ids`, `view_count` |
| `lp_product_events` | older per-product view/session/CTA events |

Also available: `lib/actions/product-insights.ts` already computes per-product
read/curious/left, bounce, median dwell, funnel and a health grade — reuse it
rather than recomputing, and `/panel/analytics` renders it.

**Always state the observation window.** A burst of sessions inside two hours is
a live campaign; a flat week is organic. They demand different advice.

## Step 2 — Build the funnel

```
ad clicks (from the ad platform, if available)
  → sessions            lp_sessions
  → preview views       lp_page_events where page_type='preview'
  → engaged (curious)   engagement != 'left'
  → read                engagement = 'read'
  → checkout views      page_type='checkout'
  → purchases           lp_purchases
```

Report the drop-off at **each** step, and name the single worst one. Most
campaigns have exactly one dominant leak; fixing the others first wastes effort.

For serialised products (Part 1 → Part 2 → Part 3), also compute the
**continuation rate** between parts. A collapse there (e.g. 1178 → 27) is a
navigation/CTA failure, not a content failure — check `next_product_id` is set
and the end-of-part CTA renders.

## Step 3 — Technical delivery audit (do this before any creative judgement)

Measure the **actual landing URL**, not a local dev server:

```bash
curl -s -o /dev/null -w "TTFB=%{time_starttransfer}s total=%{time_total}s size=%{size_download}\n" <url>
curl -s -I <url> | grep -iE "x-vercel-id|x-vercel-cache|cache-control"
```

Check every one of these:

- **Time to first meaningful content** — not TTFB alone. If a reader/viewer
  fetches an asset before painting text, measure that asset's size and divide by
  a realistic mobile speed (**~0.7 MB/s** for average Indonesian 4G).
- **Blocking payload weight.** What must download before the visitor sees
  anything? Images/fonts/archives that block first paint are the usual culprit.
- **`x-vercel-id`** reveals the function region. Functions must sit near the
  **Tokyo** database (`hnd1`); running in `iad1` puts a Pacific round trip on
  every query. A page making ~6 queries pays that six times.
- **Cold vs warm cache.** Measure both — an endpoint that unzips or renders on
  demand is fast only after the first hit. Ad bursts hit cold caches.
- **Streaming.** Does the shell flush before the data queries resolve? Check
  whether the first byte already contains visible content.
- **Render path.** `ssr: false` dynamic imports paint nothing until the bundle
  lands.
- Mobile realities: iOS Safari address-bar behaviour, Instagram's in-app
  browser, images not lazy-loaded, no width/height causing layout shift.

## Step 4 — Sanity-check the telemetry itself

**Do not trust a metric you haven't validated.** This project shipped a bug
where `scroll_depth` reported a perfect 100% because it was measured before
async content injected — a non-scrollable page looked fully read.

Before drawing conclusions, ask of each metric: could this value be produced by
a bug rather than a human? Red flags: suspiciously round numbers, 100%/0%
clustering, dwell shorter than the page's own load time, identical values across
sessions. Say plainly which metrics you trust and which you don't.

## Step 5 — UX / creative audit

Only once delivery is clean:

- **First screen** — is the value legible in ~2 seconds on a phone? Is the hook
  above the fold, or buried under a cover image?
- **Bounce shape** — bulk under 8s points at load time or a mismatch between ad
  promise and landing content. Drop-off at 20–40s points at weak content or a
  missing next step.
- **Ad-to-landing congruence** — does the page deliver what the creative
  promised? A mismatch reads as bounce that looks like disinterest.
- **CTA** — visible without scrolling? Reveal timing sensible? Wording concrete?
- **Price band** — compare the asking price against what has *actually* sold.
  Check `lp_purchases.amount` history; an ask well above the proven band with
  zero sales is a pricing problem, not a traffic problem.
- **Retention/return path** — is there a reason to come back? Series CTA,
  bundle, favourites, email capture. Count repeat `visitor_id`s: people
  returning without buying are a retargeting signal *and* evidence of interest
  blocked by something else.

## Step 6 — Segment before concluding

Averages hide the answer. Split by:

- **Source / campaign** (`utm_source`, `utm_campaign`, `referrer_host`) — rank by
  **read rate, not clicks**. Cheap clicks that never read are worse than
  expensive ones that do.
- **Device / OS / browser** — a large gap (e.g. read rate strong on iOS, poor on
  Android) usually means a rendering or performance bug on the weak platform.
- **Geo** — city-level concentration tells you whether targeting landed.
- **Hour of day** (WIB) — when do the *engaged* sessions cluster? Ad scheduling
  follows that, not total traffic.

## Step 7 — Timing check

- Is the product **in season**, and is the window still open?
- Where is it in the **trend lifecycle** — emerging / rising / peaked / evergreen?
  Use web search and **cite** it; never assert a trend from memory.
- Does the launch/promo align with **payday** or a sale day?
- Be honest when timing is *not* the problem. It's a comfortable explanation and
  frequently the wrong one — the opening example proves it.

## Step 8 — Compare against the last report, then save this one

Reports are kept in `docs/campaign-reports/` as
`YYYY-MM-DD-<product-slug>.md`. They turn one-off opinions into a time series:
without the previous numbers you can't tell whether a fix worked or the traffic
just changed.

**Before writing the analysis**, read the most recent report for this product
(if any) and diff the headline metrics against it. Lead the output with what
moved, and say plainly whether the last round of fixes helped, did nothing, or
made things worse — including your own.

**After presenting the analysis**, always save it to that path. Open with a
frontmatter block so later runs can compare without re-parsing prose:

```markdown
---
product: sampai-hujan-reda
window_start: 2026-07-25T16:07Z
window_end: 2026-07-27T15:46Z
sessions: 642
preview_views: 610
engaged: 75
read: 16
checkout_views: 17
purchases: 0
bounce_under_8s: 0.73
median_dwell_ms: 2300
read_rate: 0.025
top_source: "120248086701560423"
verdict: "paid placement quality — organic reads 19x better"
fixes_shipped_since_last: ["server-side epub text", "hnd1 region", "streamed shell"]
---
```

Keep the frontmatter keys stable across reports — a renamed key breaks the
comparison. Add new ones freely; don't repurpose old ones.

Note in the report which fixes had been shipped during the window, so a later
reader can attribute changes. Segment the metrics by deploy time when a fix
landed mid-window (`git log --date=format-local:'%Y-%m-%dT%H:%M' --format="%cd  %s"`),
rather than reporting one blended average that hides the effect.

## Output format

```
📊 CAMPAIGN: <product> · <window> · <n> sessions
Verdict: <one sentence — is this working, and what is the single biggest leak>

FUNNEL
  clicks → sessions → preview → engaged → read → checkout → purchase
  <numbers + the worst drop-off called out>

🔧 TECHNICAL
  <measured findings: TTFB, blocking payload, time-to-first-content, region,
   cache; or "clean — measured X, Y, Z">

🎯 UX / CREATIVE
  <hook, bounce shape, CTA, price band, retention>

⏰ TIMING
  <in season? trend stage (cited)? payday alignment? verdict>

🧩 SEGMENTS
  <best/worst source by read rate, device gaps, geo, active hours>

⚠️ TELEMETRY CAVEATS
  <metrics you don't trust, and why>

✅ FIXES — ranked by expected impact
  1. <specific, actionable, with the metric it should move>
  2. …
  <mark each: technical / UX / pricing / timing / content>

⏭ NEXT
  <what to measure after the fixes, and when to re-check>

📁 Saved to docs/campaign-reports/<YYYY-MM-DD>-<slug>.md
```

When a previous report exists, put a short delta table directly under the
verdict — previous vs now for the headline metrics, with the fixes shipped in
between — before the full funnel.

## Principles

- **Diagnose, don't flatter.** If the data says the campaign is fine and the
  product is the problem, say so — and vice versa.
- **Every claim traceable** to a query you ran or a measurement you took. Show
  the numbers. Never invent a benchmark.
- **Fixes must be specific.** "Improve the hook" is useless; "the first screen is
  a full-bleed cover — move the one-line pitch above it" is actionable.
- **Rank by expected impact**, and prefer cheap reversible fixes first. A code
  fix that recovers 80% of bounced traffic beats any creative rewrite.
- **Small numbers = wide error bars.** With a few dozen sessions, say so rather
  than over-reading noise.
- If the fix is code in this repo, offer to implement it — and remember the
  standing rule to deploy with `vercel --prod --yes` when done.
- Log the outcome afterwards so predictions calibrate (see
  `docs/ai-analytics-plan.md`, `lp_product_outcomes`).
