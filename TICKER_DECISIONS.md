# Ticker decisions — Мова

SHA at ship: `06719e1a072a3c8511de7274d70287d655d91ab9` (`main`; feature `cf4bc98`). Roles shipped: **1 (social proof) + 3 (brand manifesto)**.

## Funnel roles (chosen)

| Role | Why for Мова | Placement |
| --- | --- | --- |
| **3 · Brand manifesto** | Dry expert framing before hero (fix-price / slot / guarantee). Reinforces brand without competing with calc CTA. | Sticky strip **above nav**, site-wide via `SiteHeader` |
| **1 · Social proof** | Trust + light urgency before booking. DB-backed done orders (7d), anonymized; slots free today. Empty → manifesto/fallback JSON. | Home, **immediately above `#booking`** |

Not shipped: between hero and calc (steals first-viewport budget), model-page-only ticker (nav already carries manifesto), above footer (weak funnel).

## Placement analysis (considered)

| Spot | Hypothesis | Metric | Decision |
| --- | --- | --- | --- |
| Above nav (mav.farm) | Early brand / anti-fairground framing ↓ bounce | bounce, `calc_open` rate | **Ship** — manifesto |
| Between hero & calc | Proof before price | `calc_open` | No — hero must stay brand+CTA+calc |
| Between calc & segments | Soft trust after price | scroll depth to segments | Skip — redundant with pre-booking |
| Above `#booking` | Proof → form | `form_start`, `form_submit` | **Ship** — social |
| Model pages extra strip | Model-specific urgency | model `form_start` | Skip v1 — nav covers manifesto |
| Above footer | Reminder | rare clicks | No — low intent |

## Design

- BG `var(--ink)` (#0e0f10); FG `var(--text)` warm paper (Mova `--bg` is page charcoal — not usable as light FG; documented here).
- Accent separators `·` in `#FF5722`.
- Mono uppercase 12.5px / 11px mobile; height 36 / 32; tracking 0.06em.
- Desktop: CSS infinite marquee ~48–52s, pause on hover.
- Mobile (35+ men): **fade one phrase / 4s** — less busy than marquee.
- `prefers-reduced-motion`: static clipped list, no animation.

## Tech

| Choice | Why |
| --- | --- |
| `Ticker.astro` + CSS marquee | ~0 KB for motion; props: `items`, `speed`, `variant`, `pauseOnHover`, `direction`, `ariaLabel` |
| Tiny inline script (~1.5 KB) | `ticker_impression` / `ticker_click` / `ticker_pause` + mobile fade + optional `/api/ticker` refresh for social |
| `data/ticker.json` | Owner-editable manifesto / socialFallback without code |
| `/api/ticker` + 5 min server cache | Live social from `orders.status=done` last 7 days; names anonymized (first name only); no order ids / phones |
| No React island | Not needed for CSS strip; React reserved for calc/forms |

## Analytics events

- `ticker_impression` — once per strip when ≥40% visible (`meta.variant`)
- `ticker_click` — link click (`variant`, `id`, `href`)
- `ticker_pause` — desktop hover pause (`reason: hover`)

Wire into Metrika goals later if needed; first-party `/api/events` already stores them.

## Copy / preferences

- No «голос остаётся китайским».
- No «локализация», no emoji, no discount-fairground lines.
- SEO-critical lines also live in hero / honest / booking (not ticker-only).

## Checks

- [ ] Desktop 1440 / 768: marquee no horizontal page scroll
- [ ] Mobile 390 / 360: fade mode, 32px height
- [ ] Hover pauses marquee; reduced-motion static
- [ ] Keyboard: ticker links focus-visible
- [ ] Lighthouse performance target ≥95 (ticker is CSS + tiny script)
- [ ] CLS: fixed ticker height inside sticky header

## 2-week metrics

1. `ticker_impression` (nav vs social) volume
2. `ticker_click` → `form_start` / `form_submit` conversion (social strip)
3. Bounce / `calc_open` vs pre-ship baseline
4. Empty-social fallback rate (how often manifesto/fallback serves)

## A/B hypothesis (next)

- **A:** manifesto-only top strip (control-ish)
- **B:** top strip + social above booking (current)
- Expect **B** ↑ `form_start` ≥8% relative on home sessions with `ticker_impression` social; if not by week 2, drop social or move under `#honest`.
