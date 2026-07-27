---
product: sampai-hujan-reda
window_start: 2026-07-25T16:07Z
window_end: 2026-07-27T16:11Z
sessions: 621
unique_visitors: 582
preview_views: 615
preview_events: 693
engaged: 68
read: 12
checkout_views: 11
purchases: 0
bounce_under_1s: 0.35
bounce_under_8s: 0.77
median_dwell_ms: 1900
read_rate: 0.020
logged_in_share: 0.010
repeat_visitors: 19
top_source: "120248086701560423"
verdict: "paid placement quality — organic referral reads ~12x better than the main campaign"
internal_traffic_purged: true
fixes_shipped_during_window:
  - server-side EPUB chapter text (3.42MB → 61KB blocking payload)
  - functions moved to hnd1 (co-located with the Tokyo database)
  - streamed preview shell + unblocked root layout
  - server-rendered full-bleed cover splash
  - series next-part CTA, Part 3 repriced to Rp25.000
---

# Campaign report — Sampai Hujan Reda

**Window:** 25 Jul 16:07 → 27 Jul 16:11 UTC (~48h) · 621 sessions · 582 unique visitors

**Verdict:** The main campaign is the problem. `…560423` is 74% of all traffic and
reads at 1.3%, while organic Instagram referral reads at 15.4% — roughly 12x
better. Secondary leak: a **login wall on a free book** (11 checkout views, zero
claims).

> **Numbers are net of internal traffic.** The owner's account was purged
> (25 sessions / 274 page events / 181 product events) and flagged
> `exclude_from_stats`, so these are visitor-only figures. An earlier draft of
> this report included that traffic and read slightly better than reality.

_First report for this product — no previous baseline to compare against._

## Funnel

| Step | Count | of sessions | of previous |
|---|---|---|---|
| sessions | 621 | 100% | — |
| preview view | 615 | 99.0% | 99.0% |
| **engaged (>8s)** | **68** | 10.9% | **11.1%** ← worst drop |
| read | 12 | 1.9% | 17.6% |
| checkout view | 11 | 1.8% | 1.8% |
| claimed/purchased | **0** | 0% | **0%** |

Two dominant leaks: **89% of preview viewers leave inside 8 seconds**, and all 11
who reached checkout left without claiming.

## Technical

Fixes shipped mid-window helped, but did not resolve the bounce:

| | before fixes | after |
|---|---|---|
| preview events | 141 | 552 |
| leave <1s | 45% | **32%** |
| leave <8s | 78% | 77% |
| median dwell | 1.2s | **2.0s** |
| read rate | 2.8% | 2.0% |

Sub-second exits fell by a third and median dwell nearly doubled — a real gain
— but three-quarters of visitors still leave before the content can land.

Two self-inflicted issues remain:

- **`/api/epub-cover` is a compute endpoint feeding the splash** — 2.63s on a
  cold cache vs 0.18s warm, and **every deploy invalidates it**. Roughly ten
  deploys landed during the live campaign, so waves of visitors saw a blank
  coloured screen with three dots. The already-uploaded public thumbnail serves
  the same image in 0.07–0.22s with no compute.
- **The 1.1s minimum splash hold eats the visit.** Words cannot appear before
  ~1.5–1.9s while median dwell is 1.9s — so the median visitor sees the cover
  for essentially their entire visit, and the 35% who leave under a second never
  see a word.

Measured chain (warm): HTML 0.76s → cover 0.18s (2.63s cold) → chapter text 0.68s.

## UX / creative

Parts 1 and 2 are **free**, but claiming them requires a Google/email account,
and **99% of sessions are logged out** (6 of 621). Eleven people reached checkout
for a free book; none registered. Hook quality itself looks fine — when a real
reader lands, they read.

## Segments

| Source | sessions | engaged | read | checkout |
|---|---|---|---|---|
| campaign `…560423` | 459 | 6.1% | **1.3%** | 2 |
| campaign `…850423` | 125 | 17.6% | 3.2% | 0 |
| instagram.com (organic referral) | 13 | **69.2%** | **15.4%** | 5 |
| direct | 16 | 43.8% | 0.0% | 3 |

Organic referral reads at ~12x the main paid campaign — the signature of
low-quality placement (auto-placements / Audience Network / accidental taps),
not a weak product. Campaign `…850423` is ~2.5x better than `…560423` on read
rate and worth studying before it's paused.

Devices: tablet/Android 426 (read 1.6%), mobile/iOS 180 (read 2.8%),
mobile/Android 13, desktop 2.
Geo: West Jakarta 195, East Jakarta 101, Central Jakarta 74, Bekasi 65,
South Tangerang 38, Ancol 30.
Peak engaged hours: 19:00–23:00 WIB.

## Telemetry caveats

- **"tablet/Android" (426 sessions, 69%) is not tablets.** `lib/track.ts` classes
  any Android UA lacking the `Mobile` token as a tablet, and the
  Instagram/Facebook in-app Android browser omits it. All are Chrome and
  virtually all came from paid campaigns. Read as "in-app browser".
- **Dubai (26 sessions) is *not* an ad-targeting leak** — corrected from the
  first draft. Those sessions carry **no `utm_campaign`**, and the owner is
  UAE-based, so they are almost certainly the owner's own logged-out browsing
  (which exclusion cannot catch) plus a few genuine UAE visitors. 34 sessions
  total are non-Indonesian, of which ~6 are US/HK datacentre IPs (bots).
- `scroll_depth` is null on 400/693 — correct behaviour (they leave before the
  page is scrollable), but engagement rests on dwell alone for short visits.
- **12 "read" events is a very small sample**; percentages carry wide error bars.
  The paid-vs-organic direction is too large to be noise, but the exact figures
  are not precise. Organic referral is only 13 sessions.

## Timing

**Not the constraint.** The window sits inside the payday period (25th–1st), and
organic readers engage at 69%. A product that converts for organic visitors and
not paid ones has a traffic problem, not a calendar problem. Recorded because
"wrong timing" was the original hypothesis and the data contradicts it.

## Fixes — ranked

1. **[ads]** Kill or re-target campaign `…560423` — 74% of traffic, 6% engaged,
   1.3% read. Restrict to Instagram feed/stories/reels, exclude Audience
   Network / auto-placements. *(Meta Ads Manager)*
2. **[UX]** Drop the login wall for free products — read/download without an
   account, or ask for login after reading. *(code)*
3. **[technical]** Point the splash at the public thumbnail instead of
   `/api/epub-cover`. *(code)*
4. **[technical]** Remove the 1.1s minimum splash hold. *(code)*
5. **[telemetry]** Fix in-app-browser device detection. *(code)*
6. **[ads]** Study what `…850423` does differently before pausing it — 2.5x the
   read rate of the main campaign on the same product.

_Dropped from the first draft: "fix geo targeting". Dubai traffic carries no
campaign tag and is not paid._

## Next

Do #1 first — free, and 74% of the problem. Ship #2–#4 alongside, then re-check
in 48h against these baselines: **621 sessions, `<8s` bounce 77%, median dwell
1.9s, read rate 2.0%, checkout→claim 0%**.
