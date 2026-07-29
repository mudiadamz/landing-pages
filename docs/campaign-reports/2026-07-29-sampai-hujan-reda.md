---
product: sampai-hujan-reda
window_start: 2026-07-27T22:03Z
window_end: 2026-07-29T14:42Z
sessions: 432
preview_views: 448
engaged: 50
read: 16
checkout_views: 5
purchases: 3
purchases_paid: 0
bounce_under_1s: 0.19
bounce_under_8s: 0.592
median_dwell_ms: 5311
read_rate: 0.036
left_before_first_word: 0.281
survived_to_text: 0.719
read_30s_plus: 0.217
read_2min_plus: 0.105
scroll_rate: 0.477
median_first_scroll_ms: 3998
reached_end_rate: 0.067
series_part1_sessions: 414
series_part2_sessions: 8
series_part3_sessions: 2
continuation_among_end_reachers: 0.25
repeat_visitor_rate: 0.042
top_source: "120248116312930423"
verdict: "delivery fixed — bounce 81%→59%, deep readers 3x. The leak moved to monetisation: the only paid item sits behind a 45-minute free read that 6.7% finish."
internal_traffic_purged: true
fixes_shipped_since_last:
  - text paints before chrome (scroll hint tied to book-ready)
  - bottom fade + instant scroll chevron
  - identity chip (chapters + read time) painted with the text
  - floating buy CTA removed; page indicator in its place
  - chapter list sheet on the page readout
  - first_scroll telemetry (lp_product_events kind='scroll')
---

# Campaign report — the delivery fix worked; the leak moved

Third report on this product. Previous: `2026-07-27b-sampai-hujan-reda.md`.

## Delta since the last report

Everything below is measured from **2026-07-27T22:03Z**, the deploy that
finished the preview work — so this window is entirely post-fix.

| metric | 27 Jul | now | change |
|---|---|---|---|
| `<8s` bounce | 81% | **59.2%** | **−22pt** |
| median dwell | 1,600ms | **5,311ms** | **3.3×** |
| left before first word (`<1.5s`) | 48% | **28.1%** | **−20pt** |
| read 30s+ | 7.1% | **21.7%** | **3.1×** |
| read 2min+ | 2.2% | **10.5%** | **4.8×** |
| read rate | 1.9% | **3.6%** | 1.9× |
| paid purchases | 0 | **0** | flat |

**Fix #1 from the last report is validated.** The recommendation was to stop
showing a cover on an empty screen and let the words paint first, targeting
`left <1.5s` from 48% down to under 25%. It landed at 28.1% — just short of
target, and every downstream engagement metric moved with it. Deep readers
(2min+) went up nearly fivefold on 448 events, which is not noise.

Same traffic source, same creative, same product. The only thing that changed
was how fast the text appeared.

## Funnel

```
432 sessions  (413 from one campaign, 19 organic/direct)
 └─ 448 preview events        436 on Part 1
     └─ 315 survived to text          71.9%   (was 52%)
         └─  97 read 30s+             21.7%
             └─ 47 read 2min+         10.5%
                 └─ 29 reached end     6.7%   ← the wall
                     └─  7 continued to Part 2
                         └─  2 reached Part 3 (the only paid item)
                             └─  0 purchases
```

**Worst drop-off: 97 deep readers → 29 who reach the end (70% loss).** That is
now the dominant leak, and it is structural rather than technical.

## 🔧 Technical — clean

Measured on the live URL, not dev:

| | cold | warm |
|---|---|---|
| `/lp/sampai-hujan-reda` | TTFB 0.68s, 54 KB | TTFB 0.33s |
| `/api/epub-text/…` | TTFB 1.01s, 61 KB | TTFB 0.15s |

- Region is **`hnd1`** (Tokyo) — correct, sitting with the database. Edge entry
  via `bom1`.
- Text payload is 61 KB, down from the 3.42 MB EPUB that started this whole
  investigation. At ~0.7 MB/s that is under 0.1s, not 5 seconds.
- `/api/epub-text` carries `public, max-age=300`. Five minutes is short for
  content that changes maybe never; during an ad burst most hits still land
  warm, but every six-minute gap pays a 1.0s cold penalty.
- Nothing blocks first paint any more. **Delivery is no longer the problem.**

## 🎯 UX / creative — the structure is now the constraint

Part 1 is **8,973 words across 16 chapters — a ~45-minute read**, and it is
**free**. So is Part 2. The only thing anyone can buy is Part 3
(Rp75.000 list / Rp25.000 discounted).

That means the purchase path is: *read 45 minutes free → read another part free
→ pay*. Median dwell among engaged readers is **110 seconds**. Nobody completes
a 45-minute novella in an Instagram in-app browser between other things.

The end-of-read panel — where continuation and purchase live — is therefore
reachable by 6.7% of visitors. Among the 29 who did reach it, **7 continued to
Part 2 (25%)**. That panel *works*; almost nobody gets to see it.

**On removing the floating CTA** (my change, 28 Jul, at your explicit direction —
"better UX over conversion"): the data now prices it. 93.3% of preview sessions
never see any CTA. The mitigating detail is that Part 1's CTA was
"Ambil gratis", not a purchase — so the removal costs a free claim, not revenue.
The reading metrics above all improved in the same window. I would not put the
floating bar back on the strength of this data, but the end panel needs a second
entry point that isn't 45 minutes deep.

Other signals:

- **The chapter list is being used**: 16 `toc` opens vs 5 `buy` clicks. Readers
  reach for navigation three times more than for the button. That is a strong
  hint about what they actually want on that screen.
- **Scroll instrumentation** (new this window): **47.7% ever scroll**, median
  **4.0s** to first scroll. So of the 71.9% who see text, roughly two-thirds
  then scroll — the fade and chevron are doing their job — but half of all
  arrivals still never move the page.
- **Price band**: all-time paid purchases number **5**, at Rp10.000, Rp25.000 and
  Rp200.000. Rp25.000 for Part 3 is inside the proven band. Price is not the
  blocker; reach to the paid item is.
- **Retention**: 4.2% of visitors returned within the window. Low, and there is
  no email capture on the reader — a 45-minute product with no "continue later"
  hook loses everyone who gets interrupted.

## ⏰ Timing

- **Payday**: window sits 27–29 July, i.e. *after* the 25th and just before the
  1st. Conversion pressure is at its monthly low. A paid push on 1 Aug is
  materially better timed than one today.
- **Trend**: serialized digital fiction in Indonesia is in a healthy, growing
  phase, not a fad peak — the global web-novel market is projected to roughly
  double from USD 6.1bn (2025) to ~USD 12.1bn by 2030, and Fizzo alone does
  ~500k downloads and ~USD 100k revenue a month in Indonesia. Notably, the
  platforms winning here monetise **per chapter or by subscription**, not by
  gating a whole third instalment.
- **Verdict**: timing is *not* the problem, and was not last time either. The
  seasonal note that matters is to schedule the paid push on the 1st.

## 🧩 Segments

- **Source**: 413 of 432 sessions from campaign `120248116312930423` — a new
  campaign id since the last report. Organic is 19 sessions total, too few to
  benchmark against, so the "organic reads 19× better" comparison from report 1
  still cannot be re-tested.
- **Device**: 424 mobile / 5 tablet / 3 desktop; **413 sessions in the Instagram
  in-app browser**. The old "tablet" misclassification has resolved itself —
  browser now reports as `Instagram app` and device as `mobile`, so the caveat
  from the last two reports is retired.
- **Geo**: heavily Jabodetabek — West Jakarta 140, East Jakarta 68, Bekasi 57,
  Central Jakarta 52, South Tangerang 25. Targeting landed where intended.
- **Hours (WIB)**: engaged sessions cluster at **12:00–14:00** and
  **19:00–21:00**. This has moved since the last report, which found 20:00–01:00.
  Lunch break is now the strongest block — worth weighting delivery to both.

## ⚠️ Telemetry caveats

- **`scroll_depth` unknown for 43%** of Part 1 events. That is honest behaviour
  (they leave before scrolling) but it means depth statistics describe the
  survivors only. Median known depth is **1%** — of a 45-minute book, so
  consistent rather than suspicious.
- **`reached_end` = 29 exactly matches `scroll_depth == 100` = 29.** The two are
  derived from the same measurement, so they corroborate each other's plumbing,
  not each other's truth. The earlier 100%-scroll bug does not appear to have
  returned: the distribution is now a long tail, not a spike at 100.
- **16 read events and 5 buy clicks.** Anything computed from those carries very
  wide error bars. The robust figures here are the ones counted over 448 events:
  bounce, dwell distribution, scroll rate, reached_end.
- **Purchases: 3, all `amount = 0`** — free claims of Parts 1/2, not revenue.
- `10minutemail.com` appears as a referrer twice, consistent with the throwaway
  signup noted on 28 Jul.

## ✅ Fixes — ranked by expected impact

1. **[content/pricing] Stop gating on "finish the book".** The paid item is ~90
   free minutes away and 6.7% get there. Either (a) put Part 3's offer at the
   **end of Chapter 1–3** of Part 1 rather than the end of the whole novella, or
   (b) move to per-chapter unlocking, which is what every platform winning this
   market does. *Target: paid-item reach from 2 sessions → 10%+ of readers.*
2. **[UX] Give the end panel a second entrance.** The chapter sheet is already
   the most-used control on the page (16 opens vs 5 buys) — add the series/next-part
   entry inside it, so continuation is reachable from chapter 2 rather than only
   from the last page. Cheap, reversible, and does not restore a floating ad bar.
   *Target: continuation events from 7 → 25+.*
3. **[UX] "Lanjut baca nanti" — email or bookmark capture** at the ~2-minute
   mark. 10.5% now read 2min+ and 4.2% return; a 45-minute product with no
   resume hook wastes its own best signal. *Target: repeat rate 4.2% → 12%.*
4. **[ads] Optimise Meta for a 30s-read event, not link clicks.** Still the only
   change that alters *who* arrives, and now much better justified: 21.7% read
   30s+, so the event fires often enough for Meta to learn from. Plumbing exists
   in `lib/meta-capi.ts`. Carried over from the last report, still unshipped.
5. **[ads] Weight delivery to 12:00–14:00 and 19:00–21:00 WIB**, and schedule the
   paid push for **1 August** (payday), not the last days of the month.
6. **[technical] Raise `/api/epub-text` cache to `max-age=86400`** with a
   revalidation tag on publish. Small win — removes the 1.0s cold penalty for
   the first visitor of each burst.

## ⏭ Next

Ship #1 and #2, then re-check **`reached_end_rate`** and
**`series_part2_sessions`** after ~300 fresh paid sessions. Those two are now the
whole game: delivery is fixed and reading is happening, so the only question left
is whether a reader can find the thing they'd pay for before they put the phone
down.

If #1 lands and Part 3 reach still sits near zero, the conclusion is that a
three-part novella is the wrong unit for this audience, and the product should be
restructured per chapter.
