---
product: sampai-hujan-reda
window_start: 2026-07-25T16:07Z
window_end: 2026-07-27T15:46Z
sessions: 642
unique_visitors: 583
preview_views: 610
engaged: 75
read: 16
checkout_views: 17
purchases: 0
bounce_under_1s: 0.30
bounce_under_8s: 0.73
median_dwell_ms: 2300
read_rate: 0.025
logged_in_share: 0.048
repeat_visitors: 23
top_source: "120248086701560423"
verdict: "paid placement quality — organic reads ~19x better than the main campaign"
fixes_shipped_during_window:
  - server-side EPUB chapter text (3.42MB → 61KB blocking payload)
  - functions moved to hnd1 (co-located with the Tokyo database)
  - streamed preview shell + unblocked root layout
  - server-rendered full-bleed cover splash
  - series next-part CTA, Part 3 repriced to Rp25.000
---

# Campaign report — Sampai Hujan Reda

**Window:** 25 Jul 16:07 → 27 Jul 15:46 UTC (~48h) · 642 sessions · 583 unique visitors

**Verdict:** The product works — organic readers engage at 67% and read at 21%.
The paid traffic doesn't: campaign `…560423` is 71% of all sessions and reads at
1.1%. The biggest leak is **ad placement quality**, not the product; the second
is a **login wall on a free book**.

_First report for this product — no previous baseline to compare against._

## Funnel

| Step | Count | of sessions | of previous |
|---|---|---|---|
| sessions | 642 | 100% | — |
| preview view | 610 | 95.0% | 95.0% |
| **engaged (>8s)** | **75** | 11.7% | **12.3%** ← worst drop |
| read | 16 | 2.5% | 21.3% |
| checkout view | 17 | 2.6% | 2.8% |
| claimed/purchased | **0** | 0% | **0%** |

Two dominant leaks: 88% of preview viewers leave inside 8 seconds, and all 17
who reached checkout bounced.

## Technical

The fixes shipped mid-window helped, but did not resolve it:

| | before fixes | after |
|---|---|---|
| leave <1s | 47% | 30% |
| leave <8s | 79% | 73% |
| median dwell | 1.1s | 2.3s |

Phase-by-phase (segmented by deploy time):

| phase | n | <1s | <8s | median | read |
|---|---|---|---|---|---|
| A pre-everything | 132 | 47% | 79% | 1.1s | 3.0% |
| B client splash | 18 | 6% | 67% | 6.9s | 0.0% |
| C SSR splash + perf | 13 | 0% | 92% | 4.2s | 0.0% |
| D full-bleed splash | 90 | 31% | 76% | 3.2s | 1.1% |
| E after nav-crash fix | 507 | 30% | 73% | 2.3s | 2.8% |

(B and C have too few sessions to read into.)

Two self-inflicted issues remain:

- **`/api/epub-cover` is a compute endpoint feeding the splash** — measured
  2.63s on a cold cache vs 0.18s warm, and every deploy invalidates it. ~10
  deploys landed during the live campaign, so waves of visitors saw a blank
  coloured screen with three dots. The already-uploaded public thumbnail serves
  the same image in 0.07–0.22s with no compute.
- **The 1.1s minimum splash hold eats the visit.** Words cannot appear before
  ~1.5–1.9s while median dwell is 2.3s — so the median visitor sees the cover
  for most of their visit, and the 30% who leave under a second never see a word.

Measured chain (warm): HTML 0.76s → cover 0.18s (2.63s cold) → chapter text
0.68s.

## UX / creative

Parts 1 and 2 are **free**, but claiming them requires a Google/email account,
and **95% of sessions (611/642) are logged out**. 17 people reached checkout for
a free book; none registered. Hook quality itself looks fine — when a genuine
reader lands, they read.

## Segments

| Source | sessions | engaged | read | checkout |
|---|---|---|---|---|
| campaign `…560423` | 455 | 6% | 1.1% | 2 |
| campaign `…850423` | 125 | 18% | 3.2% | 0 |
| direct | 41 | 67% | 20.8% | 10 |
| instagram.com (organic) | 13 | 69% | 15.4% | 5 |

Organic reads at ~19x the main paid campaign — the signature of low-quality
placement (auto-placements / Audience Network / accidental taps), not a weak
product.

Geo: West Jakarta 192, East Jakarta 101, Central Jakarta 74, Bekasi 65,
**Dubai 41 (6% — targeting leak)**, South Tangerang 38.
Peak engaged hours: 19:00–23:00 WIB.

## Telemetry caveats

- **"tablet/Android" (424 sessions, 66%) is not tablets.** `lib/track.ts` classes
  any Android UA lacking the `Mobile` token as a tablet, and the
  Instagram/Facebook in-app Android browser omits it. All 424 are Chrome and
  423/424 came from paid campaigns (organic has exactly 1). Read as "in-app
  browser".
- `scroll_depth` is null on 302/615 post-fix — correct behaviour (they leave
  before the page is scrollable), but engagement rests on dwell alone for short
  visits.
- 16 "read" events is a small sample: percentages carry wide error bars. The
  paid-vs-organic direction is far too large to be noise; the exact figures are
  not precise.

## Timing

**Not the constraint.** The window sits inside the payday period (25th–1st), and
organic readers engage at 67%. A product that converts for organic visitors and
not paid ones has a traffic problem, not a calendar problem. Worth recording
because "wrong timing" was the original hypothesis, and the data contradicts it.

## Fixes — ranked

1. **[ads]** Kill or re-target campaign `…560423` — 71% of traffic, 6%
   engagement, 1.1% read. Restrict to Instagram feed/stories/reels, exclude
   Audience Network / auto-placements. *(Meta Ads Manager)*
2. **[UX]** Drop the login wall for free products — read/download without an
   account, or ask for login after reading. *(code)*
3. **[technical]** Point the splash at the public thumbnail instead of
   `/api/epub-cover`. *(code)*
4. **[technical]** Remove the 1.1s minimum splash hold. *(code)*
5. **[ads]** Fix geo targeting — 6% of spend landing in Dubai.
6. **[telemetry]** Fix in-app-browser device detection. *(code)*

## Next

Do #1 first — free, and 71% of the problem. Ship #2–#4 alongside, then re-check
in 48h against these baselines: `<8s bounce 73%`, `read rate 2.5%`,
`checkout→claim 0%`.
