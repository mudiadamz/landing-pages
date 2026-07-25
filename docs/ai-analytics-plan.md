# AI Analytics & Product-Strategy Engine — Build Plan

Status: **planned** · Owner: Adam · Last updated: 2026-07-25

The current analytics stack (session/journey tracking + behaviour-derived
per-product summaries) is **descriptive**. This plan extends it into a
**prescriptive** system: AI experts that read behaviour + the product itself +
the real world, and tell you what's wrong, what to promote, and **what to make
next (and when)**.

---

## 1. Goal

Turn tracking data into decisions:

1. **Is this product good, and who is it for?** — behaviour + vision critique.
2. **What should I push right now, where, and when?** — trends + events + geo.
3. **What product should I create next, and what's the launch window?** —
   demand forecasting with timing as a first-class output.

The trigger insight: a launched ebook failed on **timing**. Timing must be a
modeled dimension, and every launch must become a **labeled outcome** the system
learns from.

## 2. Architecture — three layers on a shared spine

```
Layer 1  BEHAVIOUR        (have)     engagement, dwell, scroll, funnel, geo, source, trend
Layer 2  THE PRODUCT      (needs AI) thumbnail, first-screen shot, copy, price, format, tags
Layer 3  MARKET CONTEXT   (needs AI) events/seasonality, regional signals, live trends, ad cost

Experts built on these:
  Product Expert      = L2 × L1     "is this good & for whom"
  Market Radar        = L3 × L1     "what to push, where, when"
  Opportunity Engine  = L3 × L2 × outcomes   "what to MAKE next, launch WHEN"

Shared spine: product tagging · launch-outcome log · export bundle · Anthropic API (Opus 4.8 vision) · web-search grounding
```

Keystones (everything depends on these two): **product tags** and **labeled
launch outcomes**. Neither can be backfilled well, so they come early.

## 3. Tech choices

- **Model:** Claude Opus 4.8 (vision) for reports/critique; Sonnet 5 acceptable
  for cheaper/high-volume passes. Structured output (JSON schema) for every AI call.
- **Grounding:** live-trend claims MUST cite sources (web search / Supermetrics
  MCP / Google Trends). No uncited "trends." A relevance filter drops blips.
- **Ad data:** the connected **Supermetrics MCP** supplies spend/impressions/CTR
  for true ROAS/CPA.
- **Screenshots:** a headless render of the preview first screen for the vision pass.
- All new tables use the **`lp_`** prefix; writes via service-role routes, reads
  via admin server actions (same pattern as `lp_sessions`).
- Secrets: `ANTHROPIC_API_KEY` (server-only), plus existing Supabase/Supermetrics.

---

## 4. Phases

### Phase 1 — Capture the gaps (time-sensitive; do first)

Richer signals can't be backfilled — start recording now. Extends
`components/session-tracker.tsx` and adds a granular events table.

**Data model** — `lp_interaction_events` (`session_id`, `visitor_id`,
`product_slug`, `type`, `value jsonb`, `created_at`), types:
- `scroll_milestone` (25/50/75/100) + `time_to_first_scroll_ms`
- `dwell_section` (dwell per scroll band → where attention concentrates)
- `rage_click`, `idle`, `quick_back` (frustration / low-fit signals)
- `copy_attempt`, `zoom`, `image_open`, `page_flip` (PDF/EPUB), `cta_hover_no_click`
- `video_play` + `video_progress` (% watched)

**Exit micro-survey** — 1-tap on preview exit ("Kenapa belum ambil?": Harga /
Belum butuh / Ragu kualitas / Cuma lihat-lihat). Store in `lp_exit_feedback`
(`session_id`, `product_slug`, `reason`, `created_at`). Gives the model real
*reasons*, not just inferences.

**On-site search logging** — `lp_search_queries` (`query`, `results_count`,
`user_id?`, `created_at`). Zero-result and high-frequency queries = unmet demand,
the richest input to the Opportunity Engine.

**Small fixes** — store session tz offset; stitch `visitor_id ↔ user_id` on login.

Deliverables: migration, tracker extensions, exit-survey UI, search-capture hook.
Effort: **low–med**. Depends on: nothing.

### Phase 2 — Keystone: product tags + launch-outcome log

**Product tagging** — one-time (then on create/edit) AI vision+text pass over the
catalog. `lp_product_tags` or JSON column on `lp_landing_pages`:
`themes[]`, `style[]`, `audience[]`, `use_case[]`, `format`, `reading_length`,
`quality_notes`. Enables trend→product matching and affinity.

**Launch-outcome log** — `lp_product_outcomes` (`product_id`, `launched_at`,
`trend_stage_at_launch`, `audience_snapshot jsonb`, `units_30d`, `revenue_30d`,
`verdict` win/flat/flop, `notes`). **Seed it with the failed ebook** as the first
labeled row. This is the training signal for the predictor + post-mortems.

Deliverables: migration, an admin "tag catalog" action (AI pass), a small
outcome-logging form in the product panel.
Effort: **med**. Depends on: Anthropic integration (below), Phase 1 optional.

### Phase 3 — Export bundle + Product Expert report

**Export bundle** — `GET /api/analytics/export?product=<id>` (admin), returns one
JSON: product meta + tags, Layer-1 summary (reuse `getProductSummary`),
distributions (engagement / scroll-depth / dwell / hour×day heatmap),
source/geo/device breakdowns, trend, exit-survey reasons, **image URLs**, and
(optional) ad metrics. Portfolio variant returns all products + affinity matrix.
Immediate value: paste into Claude even before the in-app report exists.

**Product Expert** — server action → Anthropic API (Opus 4.8, vision) with the
bundle + thumbnail + first-screen screenshot → structured report:
- Visual/creative critique (hook, clarity, trust, clutter) correlated with bounce
- Copy/persuasion critique
- Behaviour diagnosis (reuses funnel/stage)
- Audience & timing read
- Ranked, dated action list + predicted impact + confidence

Rendered on `/panel/product/[id]/stats` (and a portfolio strategist view in
`/panel/analytics`). Cache reports; regenerate on demand.

Deliverables: export route, `lib/ai/*` (Anthropic client, schemas, prompts),
screenshot util, report UI, `lp_ai_reports` cache table.
Effort: **med–high**. Depends on: Phase 2 (tags), Phase 1 (richer signals ideal).

### Phase 4 — Market Radar

**Events calendar** — `lp_events_calendar` seeded with ID holidays, sale days
(Harbolnas 11.11/12.12/…), payday cycle, seasons. Deterministic half (no
hallucination).

**Live + regional trends** — scheduled AI job (cron, weekly + a faster live tick)
with web-search grounding: demand trends, aesthetic trends, topical moments;
cross-referenced with rising-traffic **regions** (from `lp_sessions` geo).

**Output** — a "Market Radar" briefing (stored in `lp_market_radar`): Upcoming
(events → matched products → prep dates), Right-now (live trends → catalog match),
Regional callouts, and catalog **gaps** (trending demand with no product). Every
claim cited. Rendered in `/panel/analytics` (new tab) + optional email digest.

Deliverables: calendar migration+seed, cron job, grounded-AI pipeline, radar UI.
Effort: **high**. Depends on: Phase 2 (tags), geo data (have).

### Phase 5 — Combinations / bundles

**Affinity (computable now)** — co-view (visitors who previewed A also previewed
B, from `lp_page_events` by visitor), co-purchase / market-basket (from
`lp_purchases` by user), sequential (view A → buy B). Materialize an affinity
matrix (nightly).

**AI bundling** — top affinity pairs + thumbnails/tags → Claude names + prices a
bundle judged on thematic/visual fit ("Starter Branding Kit, save 20%"). Surfaced
as cross-sell suggestions + a bundle-builder in the panel.

Deliverables: affinity job + table, bundle-suggestion action + UI.
Effort: **med**. Depends on: Phase 2 (tags) for quality.

### Phase 6 — Product Opportunity Engine (apex)

**Candidate generation** — trend mining (Radar), own demand gaps (zero-result
searches, high-traffic/low-conversion categories, favorites-without-purchase),
seasonal calendar backward, competitor whitespace, AI ideation from proven
audience + trend.

**Scoring** — per candidate across: Demand, **Trend stage** (emerging/rising/
peak/declining/evergreen), **Timing window**, Audience fit (vs your geo/price/
device profile), Competition/saturation, Your capability/lead-time, Monetization.
Show as a radar, not one number.

**Timing model** (the ebook fix) — trend-lifecycle detection + backward launch
planning `launch_by = event_date − production_time − ramp_time` + payday
alignment + a **"too late"** verdict when the window can't be hit.

**Learning loop** — post-mortem tool (diagnose *which* dimension failed for a past
launch, starting with the ebook) + calibration that reweights signals from
`lp_product_outcomes` as more launches are labeled.

**Output** — an "Opportunity Board" (`lp_opportunities`): concept + AI-drafted
angle/title/cover direction, target audience/region, cited demand evidence, trend
stage, **recommended launch window (dates)**, predicted demand/revenue range +
confidence, differentiation, verdict (Make now / Prep for window / Watch / Skip).

Deliverables: candidate generators, scoring pipeline, timing model, post-mortem,
board UI, outcome-feedback wiring.
Effort: **high**. Depends on: Phases 2 (tags+outcomes), 4 (radar), 1 (search/demand).

---

## 5. Data model summary (all `lp_`-prefixed, RLS: service-role write / admin read)

| Table | Purpose | Phase |
|---|---|---|
| `lp_interaction_events` | granular in-page micro-events | 1 |
| `lp_exit_feedback` | 1-tap exit reasons | 1 |
| `lp_search_queries` | on-site search (unmet demand) | 1 |
| `lp_product_tags` (or JSON col) | machine-readable product themes | 2 |
| `lp_product_outcomes` | labeled launch results (learning) | 2 |
| `lp_ai_reports` | cached Product Expert reports | 3 |
| `lp_events_calendar` | ID holidays / sale days / payday | 4 |
| `lp_market_radar` | generated trend briefings | 4 |
| `lp_product_affinity` | co-view/co-purchase matrix | 5 |
| `lp_opportunities` | Opportunity Board candidates | 6 |

## 6. Sequencing & rationale

1. **Phase 1 first** — capture gaps are **time-sensitive**; you can't backfill
   scroll depth, exit reasons, or searches you never recorded.
2. **Phase 2 next** — tags + outcomes are the keystone for every expert; log the
   failed ebook immediately as outcome #1.
3. **Phase 3** — export + Product Expert delivers the first visible AI payoff on
   data you already have.
4. **Phases 4–5** — Radar + bundles add market context and cross-sell.
5. **Phase 6 last** — the predictor is only as good as the tags + outcomes beneath
   it; build once they've accumulated.

Phases 1 and (the Anthropic integration inside) 2/3 can proceed in parallel.

## 7. Risks & limits

- **Grounding:** live trends must cite real sources; an invented trend is worse
  than none. Relevance filter required.
- **Small-N calibration:** with few labeled outcomes, the predictor outputs
  ranges + confidence, not promises. Accuracy compounds as launches are logged.
- **Privacy:** already storing raw IP/geo (disclosed in `/privacy`); micro-events
  and survey reasons are behavioural, not PII — keep it that way (no keystroke/
  content capture). Update the privacy page when Phase 1 ships.
- **Cost:** AI reports are on-demand + cached; Radar is scheduled, not per-request.
- **Coexistence:** additive to existing `lp_product_events` / GA4 / Meta / GTM.

## 8. Success metrics

- Fewer mistimed launches (Opportunity Engine flags "too late" before production).
- Higher read-rate / conversion on products shipped with Expert-guided fixes.
- Ad budget shifted toward campaigns with high *read-rate*, not just clicks.
- A growing `lp_product_outcomes` log that measurably improves prediction calibration.
