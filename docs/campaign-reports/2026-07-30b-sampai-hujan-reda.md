---
product: sampai-hujan-reda
window_start: 2026-07-30T00:00Z
window_end: 2026-07-30T20:45Z
sessions: 204
preview_views: 207
engaged: 20
read: 7
checkout_views: 2
purchases: 0
purchases_paid: 0
bounce_under_1s: 0.251
bounce_under_8s: 0.643
median_dwell_ms: 3264
read_rate: 0.034
reached_end_rate: 0.053
series_part1_previews: 206
series_part2_previews: 1
series_part3_previews: 0
continuation_part1_to_part2: 0.005
top_source: "ig"
paid_traffic_share: 1.0
internal_traffic_purged: true
# Whole-campaign totals (25-30 Jul), from the three ad sets supplied by the owner
campaign_spend_idr: 2139725
campaign_impressions: 318426
campaign_link_clicks: 3453
campaign_visits_meta: 2456
campaign_sessions_recorded: 1296
campaign_cpm_idr: 6720
campaign_cost_per_visit_idr: 871
campaign_preview_events: 1380
campaign_checkout_events: 12
campaign_checkout_events_paid_product: 0
campaign_purchases: 0
breakeven_conversion_at_25k: 0.0348
verdict: "Not a traffic failure — the ads are 3.4x cheaper than the Indonesian CPM average. It is a unit-economics failure (Rp871/visit against a Rp25.000 product needs 3.48% conversion) pointed at a free product, landing on a screen that shows a book cover instead of the book."
fixes_shipped_since_last:
  - Part 2 setelah-hujan-reda changed from free to Rp25.000
  - popup banner enabled (20:38Z — 7 minutes before window end, no data yet)
corrections_to_previous_report:
  - "30 Jul report said 'prose present in the first byte'. False. The served HTML contains 152 characters of visible text and zero prose; the reader is an ssr:false dynamic import."
  - "30 Jul report declared delivery 'clean' and ranked all fixes at pricing. Delivery is not clean."
---

# Sampai Hujan Reda — 30 Jul 2026 (second run)

## Correction to the previous report

Two claims I made this morning were wrong, and they mattered because they sent
every recommendation toward pricing.

**"Prose present in the first byte" — false.** The served HTML for
`/lp/sampai-hujan-reda` contains **152 characters** of visible text: the page
title, a CTA bar, and the Part 2 upsell. Searching the raw HTML including the
RSC payload for `BAB`, `Basah`, `Langit`, `payung` returns **zero hits**. The
3.42 MB blocking EPUB is genuinely gone — that fix (25 Jul, `97ed623`) was real
— but it moved the parse to the server, not the render. The reader has been an
`ssr: false` dynamic import since 24 Jul (`9870f38`) and still is.

**"Delivery is clean" — false.** See below. I ranked pricing first on the
strength of a measurement I did not actually take.

## Delta vs 2026-07-30 (first run)

| Metric | Prev (30 Jul am) | Now (30 Jul pm) |
|---|---|---|
| Sessions | 254 | 204 |
| Bounce <1s | 23.0% | 25.1% |
| Bounce <8s | 63.1% | 64.3% |
| Engaged | 9.5% | 9.7% |
| Read | 2.7% | 3.4% |
| Median dwell | 3.7s | 3.3s |
| Checkout views | 2 | 2 |
| Paid purchases | 0 | 0 |

Flat. Part 2 went from free to Rp25.000 during the window; too early to read.

## The campaign, whole

From the three ad sets supplied:

| | Ad 1 | Ad 2 | Ad 3 | Total |
|---|---|---|---|---|
| Spend | Rp1.422.626 | Rp266.016 | Rp451.083 | **Rp2.139.725** |
| Impressions | 216.841 | 47.386 | 54.199 | 318.426 |
| Link clicks | 2.170 | 566 | 717 | 3.453 |
| Website visits | 1.513 | 398 | 545 | 2.456 |
| Cost/visit | Rp940 | Rp668 | Rp828 | **Rp871** |

Six days of first-party data (25–30 Jul):

```
2.456 Meta-reported visits
→ 1.296 recorded ig sessions   (47% unaccounted — see caveats)
→ 1.380 preview events
→   136 engaged                (9.9%)
→    36 read                   (2.6%)
→    12 checkout views         (0.9%)  ← 11 of them for the FREE Part 1
→     0 purchases
```

## Why it isn't selling — three reasons, in order

### 1. The arithmetic never closed (pricing — the dominant one)

At **Rp871 per visit** against a **Rp25.000** product, you need **3.48% of every
visitor to buy** just to return the ad spend. Cold Instagram traffic to an
unknown novel converts at roughly 0.5–2%.

What each conversion rate would require as a price to break even:

| Conversion | Price needed |
|---|---|
| 0.5% | Rp174.245 |
| 1.0% | Rp87.122 |
| 1.5% | Rp58.082 |
| 2.0% | Rp43.561 |

The proven band on this store is Rp25.000 (3 sales), Rp10.000 (1), Rp200.000
(1) — **Rp285.000 lifetime revenue across the whole catalogue**. This campaign
spent **7.5× the store's entire lifetime revenue** in six days. No funnel fix
closes a gap that starts this wide; the campaign was unprofitable on the day it
was designed.

### 2. The ads point at a free product

100% of traffic lands on `/lp/sampai-hujan-reda`, which is free. Across 1.380
preview events in six days:

```
sampai-hujan-reda           FREE        1.355 previews
setelah-hujan-reda          Rp25.000       20 previews  (1.5%)
akhrinya-hujan-reda-part-3  Rp75k→25k       4 previews  (0.3%)
```

**Every one of the 12 checkout events was for a free product** (11 Part 1, 1
`jualan-tanpa-teriak`). Not a single visitor in six days reached a checkout that
could take money. The campaign has been buying readers for a giveaway.

### 3. The first screen is a book cover, not the book (technical)

Measured on the live URL:

| Step | Weight | Measured |
|---|---|---|
| HTML | 9.8 KB gz | TTFB 0.26–0.59s |
| Cover splash `/api/epub-cover` | **99 KB WebP** | TTFB 0.93s |
| Eager JS + CSS | **220.8 KB gz** (13 files) | — |
| Lazy `epub-inline-viewer` chunk | after hydration | — |
| `/api/epub-text` | 20.8 KB gz | TTFB 0.17s warm, HIT |

`EpubBootSplash` renders server-side and holds the whole viewport until the
client reader signals ready (`MIN_SPLASH_MS` is only 350ms, so the splash
duration *is* the waterfall duration). Prose therefore needs **four sequential
round trips**: HTML → 220 KB of JS → lazy viewer chunk → text API.

Region is right (`x-vercel-id: bom1::sin1::…`, co-located with the Singapore
database). Transfer is small. But **48.3% of visitors leave inside 3 seconds**
and the median dwell is **3.26s** — the audience is leaving at roughly the
moment the first word arrives. They are paying full attention to a cover image.

This is not the 2024-style 3.42 MB stall. It is a smaller, subtler version of
the same mistake, and I missed it this morning.

## Timing — not the problem

The campaign ran 25–30 July, which **includes gajian on the 25th**. It was well
timed. Indonesian e-book demand is genuinely growing and the category is not the
issue. Timing is the comfortable answer and it is wrong again here.

## Segments

- **Geo**: targeting landed cleanly — West Jakarta 63, East Jakarta 32, Bekasi
  23, South Tangerang 15, Central Jakarta 13. Jabodetabek throughout.
- **Device**: 204/204 mobile; Android 185, iOS 19.
- **Hour (WIB)**: volume peaks 21:00–23:00 (61 sessions) but engagement peaks
  13:00–16:00. Late-night traffic remains the cheapest and the worst.
- **Ad quality is the campaign's strongest asset.** CPM **Rp6.720** against a
  cited Indonesian average of Rp22.698 — **3.4× cheaper**; cost per visit Rp871
  against a cited CPC range of Rp2.936–29.362. Whoever built these creatives did
  the job. CTR 1.08% is healthy.

## Telemetry caveats

1. **47% of Meta's visits are missing from first-party data** — 2.456 reported,
   1.296 recorded. Candidates: Meta over-counting, Instagram in-app browser
   blocking storage, or genuine abandonment. Unresolved; do not treat either
   number as truth without reconciling.
2. **`lp_page_events.session_id` still joins nothing in `lp_sessions`** — the
   defect carried from the last report. Per-source and per-device read rates
   remain unavailable.
3. **`reached_end` reads 15.9% campaign-wide** against 5.7% yesterday. Too large
   a jump to be real behaviour; suspect the metric, not the readers.
4. **`scroll_depth` still untrustworthy** — not used here.
5. **Small numbers below "engaged"**: 36 readers, 12 checkout views, 0 purchases.

## Fixes — ranked by expected impact

1. **Stop the running ad set (Ad 3) today.** *(pricing)* — it is spending
   Rp153.425/day into a funnel with no reachable paid step. Every day it runs
   costs ~Rp153k for a mathematically impossible return. Cheapest, most
   reversible, largest effect.
2. **Server-render the first chapter.** *(technical)* — the text API already
   returns chapter text server-side; render the first chapter into the HTML and
   let the client reader hydrate over it. Should move the sub-3s bounce off
   48.3% and median dwell off 3.3s. This is the fix I should have ranked first
   this morning.
3. **Drop the cover splash to a thin banner, or remove it.** *(UX)* — a 99 KB
   full-viewport cover is the entire first screen. The hook should be the prose.
4. **Point the ads at something purchasable, or accept this as list-building.**
   *(pricing)* — if Part 1 stays the entry, the campaign's goal metric must be
   email captures, not sales, and it must be budgeted as marketing cost. The
   popup banner (enabled 20:38Z today, 0 subscribers, no data yet) is the right
   instrument — but at Rp871/visit an email costs more than the book earns.
5. **If selling is the goal, raise the ask or cut the cost per visit.** *(pricing)*
   — Rp25.000 needs 3.48% conversion. A bundle of Parts 2+3 at Rp50.000–58.000
   halves the required rate; retargeting only the 136 engaged readers would cut
   cost per visit far below Rp871.
6. **Shift budget from 21:00–23:00 WIB to 13:00–16:00.** *(timing)*
7. **Fix `session_id` joins.** *(technical)* — until then "which creative
   produces readers" is unanswerable.
8. **Rename `akhrinya` → `akhirnya`** with a redirect. *(UX)*

## Next

Do not re-check on a schedule — check after Ad 3 is stopped and the first
chapter is server-rendered. Then watch, in order: sub-3s bounce (target <30%),
median dwell (target >8s), and Part 2/3 previews (target >50). Purchases are not
a useful metric until a paid product is actually in the ad's path.

Sources for the benchmark figures:
[Adsumo CPM](https://adsumo.co/blog/harga-cpm-instagram-ads/),
[Adsumo CPC](https://adsumo.co/insights/biaya-instagram-ads/cpc).
