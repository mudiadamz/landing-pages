---
product: sampai-hujan-reda
window_start: 2026-07-25T16:07Z
window_end: 2026-07-27T17:12Z
sessions: 610
preview_views: 643
engaged: 58
read: 12
checkout_views: 3
purchases: 0
bounce_under_1s: 0.37
bounce_under_8s: 0.81
median_dwell_ms: 1600
read_rate: 0.019
left_before_first_word: 0.48
survived_to_text: 0.52
read_30s_plus: 0.071
read_2min_plus: 0.022
top_source: "120248086701560423"
verdict: "half the paid traffic leaves before a single word renders — they never learn it's a novel"
internal_traffic_purged: true
question_answered: "why do people with no intention to read a novel visit?"
fixes_shipped_since_last:
  - login-first CTA with product intent card
  - pay=1 auto-continue + progress overlay
  - owner reader at /read/[slug]
  - chapter typography, em tint, alignment setting
  - unified end-of-read panel (continuation before CTA)
---

# Campaign report (follow-up) — why visitors leave under 8s

Second report of the day; the first is `2026-07-27-sampai-hujan-reda.md`.
Answers a specific question: *the Instagram ad clearly says this is a NOVEL — so
why are people with no intention of reading one landing on the page?*

## Delta since the previous report

| | prev (16:11Z) | now | note |
|---|---|---|---|
| sessions | 621 | 610 | own IP purged in between |
| `<8s` bounce | 77% | 81% | worse |
| median dwell | 1.9s | 1.6s | worse |
| read rate | 2.0% | 1.9% | flat |

Only 18 preview events have landed since that report, so the UX work shipped
after it (login-first CTA, end-of-read panel, typography) is **not yet
measurable**. Treat these as the same window, not a verdict on those changes.

## The answer

**48% of paid visitors leave before the first word of the novel exists on
screen.** They cannot have judged the writing, the genre or the price — the only
thing they saw was a book cover on an otherwise empty screen.

Measured delivery chain on the live page:

```
0.00s  tap from Instagram
0.40s  HTML arrives — full-bleed COVER, no text
0.59s  cover image painted
1.10s  splash minimum hold ends      ← self-imposed
1.50s  first WORDS become visible
```

Anyone leaving before ~1.5s saw only an image. That's 306 of 631 paid preview
events.

So the premise is half wrong: it isn't that these people rejected a novel — most
never found out it *was* one. The ad may say NOVEL; the landing page's first
1.5 seconds say nothing at all.

### The traffic is real, not bots

The paid dwell curve is a smooth decay, not the spike-at-zero shape that
accidental taps and bots produce:

| dwell | share of paid |
|---|---|
| <0.5s | 18% |
| 0.5–1s | 19% |
| 1–2s | 19% |
| 2–5s | 20% |
| 5–15s | 13% |
| 15–60s | 8% |
| 60s+ | 4% |

**45 sessions (7.1%) read for 30s or more, and 14 (2.2%) for over 2 minutes.**
Genuine readers are arriving — roughly 1 in 14 paid clicks. The audience is not
entirely wrong; it is heavily diluted.

### Why the "it says NOVEL" argument doesn't hold on Instagram

1. **Meta optimises for the objective, not the content.** A Traffic / Link
   Clicks objective tells Meta to find people who habitually tap links. It will
   deliver to cheap tappers no matter how clearly the creative says NOVEL,
   because it is not being scored on whether they read.
2. **Most taps happen without reading the caption.** In-feed, the image is the
   ad; the text is scrolled past.
3. **The in-app browser is a near-zero-friction context.** ~66% of sessions are
   Instagram's in-app Android browser (misreported as "tablet" — see caveats).
   Tap, glance, swipe back costs nothing, so intent at tap time is very weak.

### The second problem, once they do see words

Of the 52% who survive to the text: **82% still leave**, median dwell 5.0s, and
only 3.7% read. So the novel's opening screen is not holding people either — but
that is the smaller number. Fixing the first 1.5s is worth roughly twice as much.

## Segments

| source | n | left <1.5s | read | ≥30s | checkout |
|---|---|---|---|---|---|
| `…560423` | 474 | 46% | 0.8% | **6.5%** | 3 |
| `…850423` | 125 | 57% | 3.2% | 4.8% | 0 |

Organic is now negligible (≤4 sessions each) — not enough to compare against, so
the 12x organic gap from the previous report can't be re-tested this window.

Engaged sessions (≥30s) cluster at **01:00, 20:00–22:00 WIB** — late evening and
past midnight, which is when people actually read fiction.

## Telemetry caveats

- **"tablet/Android" is Instagram's in-app browser**, not tablets — `lib/track.ts`
  classes an Android UA lacking the `Mobile` token as a tablet, and that browser
  omits it.
- **64% of paid preview events have unknown scroll depth**, which is correct
  behaviour (they leave before the page is scrollable) but means engagement here
  rests on dwell alone.
- **12 read events.** Percentages carry wide error bars; the 48%-before-first-word
  figure is the robust one, being a count over 631 events.

## Fixes — ranked

1. **[UX] Show the opening lines immediately instead of a cover.** A novel's own
   first sentence is the best possible qualifier: a reader stays, a non-reader
   leaves knowing why. Drop the 1.1s splash hold and let text paint at ~0.6s.
   *Target: `left <1.5s` from 48% → under 25%.* (Mine to fix — I introduced the
   hold.)
2. **[ads] Change what Meta optimises for.** Fire a Meta CAPI custom event when
   someone reads ≥30s, and optimise the campaign for that event instead of link
   clicks. This is the only change that alters *who* Meta sends. The plumbing
   already exists (`lib/meta-capi.ts`).
3. **[ads] Exclude Audience Network / auto-placements**, restrict to feed,
   stories and reels.
4. **[ads] Weight delivery to 20:00–01:00 WIB**, where real readers cluster.
5. **[content] Make the first screen earn the second.** Once text paints first,
   the opening paragraph is doing the selling — worth checking it starts on a
   hook rather than scene-setting.

## Next

Ship #1, then re-check `left_before_first_word` and `read_30s_plus` after ~200
fresh paid sessions. If #1 lands and `left <1.5s` doesn't move, the problem is
genuinely audience quality and #2 becomes the whole game.
