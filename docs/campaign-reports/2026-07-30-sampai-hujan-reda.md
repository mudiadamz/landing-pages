---
product: sampai-hujan-reda
window_start: 2026-07-29T14:57Z
window_end: 2026-07-30T16:40Z
sessions: 254
preview_views: 263
engaged: 25
read: 7
checkout_views: 2
purchases: 0
purchases_paid: 0
bounce_under_1s: 0.230
bounce_under_8s: 0.631
median_dwell_ms: 3700
read_rate: 0.027
reached_end_rate: 0.057
series_part1_previews: 260
series_part2_previews: 3
series_part3_previews: 0
continuation_part1_to_part2: 0.012
continuation_among_end_reachers: 0.27
top_source: "ig"
paid_traffic_share: 1.0
# Segment B only — after the Tokyo→Singapore cutover at 21:20Z.
post_migration_previews: 203
post_migration_bounce_under_8s: 0.606
post_migration_engaged_rate: 0.108
post_migration_read_rate: 0.034
verdict: "Delivery is clean and the migration helped. The campaign cannot convert because the only paid item sits behind TWO free full-length novels and received zero views."
internal_traffic_purged: true
fixes_shipped_since_last:
  - Supabase moved Tokyo → Singapore (ap-southeast-1), functions hnd1 → sin1
  - analytics paging fix (stopped reading the first 1000 rows as everything)
  - reader first screen given back to the prose
  - EPUB chapter editing + versioned chapter URLs
  - promo popup over the preview (shipped end of window, not yet enabled)
---

# Sampai Hujan Reda — 30 Jul 2026

## Delta vs 2026-07-29

| Metric | Prev (29 Jul) | Now (30 Jul) | Post-migration only |
|---|---|---|---|
| Sessions | 432 | 254 | — |
| Bounce <8s | 59.2% | 63.1% | **60.6%** |
| Engaged | 11.2% | 9.5% | **10.8%** |
| Read | 3.6% | 2.7% | **3.4%** |
| Median dwell | 5.3s | 3.7s | 3.8s |
| Checkout views | 5 | 2 | — |
| Paid purchases | 0 | 0 | — |

**The blended column is misleading and should not be read as a regression.** The
region migration landed mid-window. Split at the cutover, the pre-migration
segment carried 68.3% bounce, 5.0% engaged and **0% read** across 60 views; the
post-migration segment carried 60.6% / 10.8% / 3.4% across 203. Engagement
roughly doubled after the move. Against the previous report the post-migration
numbers are flat, not down.

Median dwell did fall (5.3s → 3.8s) and that is real, but it sits alongside a
higher engaged rate — consistent with more low-intent clicks arriving, not with
the page getting worse.

## Funnel

```
254 sessions (100% utm_source=ig)
 → 263 preview views
 →  25 engaged        (9.5%)
 →   7 read           (2.7%)
 →   2 checkout views (0.8%)
 →   0 purchases
```

The worst drop-off is not in this list. It is one level down:

```
Part 1  sampai-hujan-reda            FREE    260 previews
Part 2  setelah-hujan-reda           FREE      3 previews   (1.2% continuation)
Part 3  akhrinya-hujan-reda-part-3   Rp75k→25k  0 previews
```

**The campaign is buying traffic to a free product whose paid sequel is two full
novels downstream, and that sequel received zero views in 26 hours.** There is no
monetisation step in the funnel the traffic can actually reach.

## Technical

Clean. Measured on the live URL:

- Preview HTML **55 KB**, warm TTFB **0.27s**, prose present in the first byte —
  the 3.42 MB blocking EPUB that ate the July budget is gone.
- `/api/epub-text/sampai-hujan-reda` — 62.9 KB, `x-vercel-cache: HIT`,
  `cache-control: public, max-age=300`; 0.16s warm, 0.82s cold.
- `x-vercel-id: bom1::sin1::…` — functions in Singapore, co-located with the
  database in `ap-southeast-1`.

Note for future runs: the skill text still says functions must sit in `hnd1`
near a Tokyo database. That is now stale — both moved to Singapore on 29 Jul.

At ~0.7 MB/s Indonesian 4G the blocking payload is ~0.08s of transfer. Delivery
cannot explain a 60% eight-second bounce any more. The remaining bounce is
traffic quality and proposition, not engineering.

## UX / creative

- **23.0% leave under one second.** With delivery this fast that is not loading —
  it is accidental taps and ad-to-landing mismatch. Worth pulling the creative
  and checking what it promises against what the first screen delivers.
- **5.7% reach the end** of Part 1. Of those who do, **27% continue to Part 2** —
  so the continuation CTA works. The problem is that 94% never see it, because
  it lives at the end of a ~45-minute read.
- **Price band is fine where it matters.** Everything that has ever sold: 3× at
  Rp25.000, 1× at Rp10.000, 1× at Rp200.000, plus 11 free claims. Part 3's
  discounted Rp25.000 is exactly at the proven band; its Rp75.000 list price is
  3× the band and only works as an anchor.
- **Slug typo**: `akhrinya-hujan-reda-part-3` should be `akhirnya`. Cosmetic, but
  it is in every shared link for the one product that earns money.

## Timing

Indonesian e-book demand is genuinely rising — the market is described as one of
Southeast Asia's fastest-growing, with digital formats displacing print on
smartphones, and self-improvement plus short, fast-to-consume titles leading
([Cipta Publishing](https://ciptapublishing.id/tren-buku-2026-pembaca-lagi-suka-apa-sih/),
[IDN Times](https://www.idntimes.com/life/education/prediksi-tren-membaca-buku-yang-mungkin-terlihat-tahun-2026-c1c2-01-ds33r-wkrvhs),
[Cikadu](https://cikadu.id/jual-ebook-2026-cara-platform-strategi/)).

So the category is not the problem. **Timing is not the problem either** — and it
would be the comfortable answer. 30 July sits in the trough between paydays
(gajian ~25th and ~1st), so if anything the next 48 hours improve. That is worth
a few percent; the structural leak is worth everything.

## Segments

- **Source**: 100% `utm_source=ig`. No organic in this window, so no read-rate
  comparison between sources is possible — the 19× organic advantage seen on
  27 Jul cannot be re-checked here.
- **Device**: Android 229 sessions, 40.2% survive 8s. iOS 25 sessions, 24.0%
  survive. iOS looks worse but n=25 — do not act on it yet.
- **Geo**: targeting landed. West Jakarta 83, East Jakarta 42, Bekasi 26,
  Central Jakarta 20, South Tangerang 18 — Jabodetabek throughout.
- **Hour (WIB)**: volume peaks at 22:00 (35 sessions) and 23:00 (27), but
  engagement does not. 15:00 gives 7 engaged from 19 sessions (**37%**) against
  22:00's 6 from 35 (17%) and 23:00's 2 from 27 (**7%**). Late-night traffic is
  the cheapest and the worst.

## Telemetry caveats

1. **`lp_page_events.session_id` matches nothing in `lp_sessions`.** 269 events
   in-window, **0 joined**. Both are UUIDs, from two different generators. Any
   per-source, per-device or per-geo read rate is therefore unavailable — the
   device and geo splits above come from `lp_sessions.active_ms`, which is a
   different and coarser measure than `dwell_ms`. This is the single most
   valuable telemetry fix outstanding.
2. **`scroll_depth` remains untrustworthy** — 53% null, the rest clustering at 0
   and 100. Not used for any conclusion here.
3. **Small numbers.** 7 readers, 2 checkout views, 0 purchases. The funnel shape
   is reliable; nothing below "engaged" is.
4. **Migration continuity is unproven.** Hourly sessions run continuously across
   the cutover with no visible hole, but the Tokyo project has been deleted, so
   writes landing between the dump and the env swap cannot be reconciled.

## Fixes — ranked by expected impact

1. **Put a paid offer where readers actually are, not at the end.** *(pricing /
   content)* — 94% never reach the end-of-part CTA. The promo popup shipped at
   the end of this window is exactly the vehicle: an offer at 8s, or on exit,
   reaching 100% of engaged readers instead of the 5.7% who finish. Should move
   checkout views off 2.
2. **Charge for Part 2, or bundle 2+3.** *(pricing)* — two free full-length
   novels before the first paid step is not a funnel. Pricing Part 2 at
   Rp25.000, or offering 2+3 as a bundle at the proven band, creates a
   monetisation step traffic can reach. Should move paid purchases off 0.
3. **Audit the ad creative against the first screen.** *(UX)* — 23% sub-second
   exits with sub-second delivery is a promise mismatch, not a speed problem.
4. **Move ad budget from 22:00–23:00 WIB to 14:00–16:00.** *(timing)* — 37%
   engaged versus 7% on the same spend.
5. **Fix `session_id` so events join sessions.** *(technical)* — until then,
   "which source produces readers" cannot be answered at all.
6. **Rename the Part 3 slug** `akhrinya` → `akhirnya`, with a redirect. *(UX)*

## Next

Re-check in 48–72 hours, after 1 Aug payday, with a monetisation step live.
Watch: checkout views (target >10), Part 2/3 previews (target >0), and whether
sub-1s bounce falls if the creative is changed. Segment strictly post-migration —
the pre-cutover numbers are now a different architecture and must not be blended
in again.
