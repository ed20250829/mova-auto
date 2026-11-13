# TOOLKIT — Мова (mova-auto)

**Роль:** tech-scout / R&D. Продукт не переписываем — арсенал под дыры `AUDIT.md`.  
**AUDIT:** репо `AUDIT.md` @ `e0ddd22` (также store `docs/AUDIT.md`).  
**Уже в стеке (не ставить второй раз):** Astro 7, `@astrojs/react`, `@astrojs/node`, `@astrojs/sitemap`, Drizzle + `better-sqlite3`, GSAP 3.15, Lenis, React 19, Recharts, `/api/events`, Метрика `114222745` + GTM `GTM-NS7FF3LF` (после cookie), ручной JSON-LD в `src/lib/seo.ts`, Telegram Bot API вручную (`telegram.ts` / `telegram-bot.ts`), hoster.by + `server.mjs`.

**Связь с AUDIT (RICE / красные флаги → тулзы):** кейсы+LCP → `sharp`; опт-PDF импортёрам + гарантийный лист → `pdfkit`; A/B гарантия 6↔12 / бандлы → PostHog flags; SERP/entity → `astro-seo-audit` + SEO-skills (карты — руками, не npm); OTA/no-show TG → `p-retry`; mobile calc/CWV → `web-vitals` + LHCI. SampleBanner / OTA-drop / inbox «сегодня» — **баги продукта**, не новые фреймворки.

---

## 3.1 Сводная таблица (≤15)

| # | Слабое место (AUDIT) | Инструмент | Кат. | Зачем | Install | ч | Pri |
| ---: | --- | --- | --- | --- | --- | ---: | --- |
| 1 | 0 кейсов на проде; тяжёлые uploads убьют LCP | `sharp` | A | WebP/resize в `saveCaseImage` под RICE#2 | `npm i sharp` | 4 | P0 |
| 2 | Нет опт-PDF импортёрам; нет акта/гарантии | `pdfkit` | F | Опт-офер + warranty PDF после `ready` (RICE#9, флаг B) | `npm i pdfkit && npm i -D @types/pdfkit` | 8 | P0 |
| 3 | Гарантия 6 vs 12; бандлы без теста | `posthog-js` | A/E | Flags `guarantee_12m`, `bundle_sku` (RICE#7/#10) | `npm i posthog-js` | 6 | P0 |
| 4 | Head SERP пустой; meta без дисциплины | `astro-seo-audit` | A | Аудит без замены `seo.ts` (growth G) | `npm i -D astro-seo-audit` | 2 | P1 |
| 5 | TG remind OTA / −24ч no-show молчит на 429 | `p-retry` | D | Retry вокруг raw `callApi` (воронка #10–12) | `npm i p-retry` | 3 | P0 |
| 6 | Mobile fold/cookie vs calc; нет RUM CWV | `web-vitals` | A/I | LCP/INP → `/api/events` (воронка #3) | `npm i web-vitals` | 3 | P1 |
| 7 | Доверие/возражения без метода | `wondelai/skills` → `cro-methodology` | G | Кейсы/гарантия/баннер → гипотезы | `npx skills add wondelai/skills/cro-methodology` | 1 | P0 |
| 8 | SEO/schema review агентом | `coreyhaines31/marketingskills` → `seo-audit`+`schema` | G | Чеклист поверх своего JSON-LD | `npx skills add coreyhaines31/marketingskills` | 1 | P1 |
| 9 | Нет паттернов timeout/retry в API | `wondelai/skills` → `release-it` | G | TG + booking публичные эндпоинты | `npx skills add wondelai/skills/release-it` | 1 | P1 |
| 10 | JSON-LD есть, типов нет | `schema-dts` | H | Типизация `localBusinessJsonLd` | `npm i -D schema-dts` | 2 | P2 |
| 11 | Регресс скорости после кейсов | `@lhci/cli` | I | Бюджет LCP на `/` и model page | `npm i -D @lhci/cli` | 4 | P1 |
| 12 | Массовый скан `/auto/*` | `unlighthouse` | I | Разово весь каталог | `npx unlighthouse --site https://mova-auto.tech` | 2 | P2 |
| 13 | Точечный LCP кейсов | PSI + Cursor DevTools MCP | I | После `sharp` | https://pagespeed.web.dev/ + MCP | 2 | P2 |
| 14 | Микроfeedback в calc/booking (опц.) | `motion` | B | Только острова; не hero | `npm i motion` | 4 | P2 |

**14 инструментов.** Кат. **C** и **J** — в §3.3 (оставить Drizzle; явный NOT-list).

---

## 3.2 Детали

### 1. `sharp` (A) — AUDIT: кейсы P0

- **Что:** при сохранении кейса — max 1600px, WebP/JPEG q~80; бэкфилл `data/uploads/cases`.
- **Почему не `astro-imagetools` / `@astrojs/image`:** кейсы через admin upload + диск, не Astro assets. Плагин не закроет CMS.
- **Install / link:** `npm i sharp` · [github.com/lovell/sharp](https://github.com/lovell/sharp) · npm `sharp`
- **Проверка:** 8 реальных до/после на `/` и `/auto/byd/song-plus`; PSI mobile LCP не хуже baseline; сток Pexels **не** публиковать как «наши работы» (AUDIT §8.10).
- **Риски:** native rebuild на hoster после deploy.

### 2. `pdfkit` (F) — AUDIT: опт-PDF + документы

- **Что:** (a) одностраничный опт-офер −15…25% / SLA / объём 5–12 авто для холодных импортёрам; (b) гарантийный лист после `ready` (срок, модель, дата).
- **Почему не Puppeteer:** shared hoster, RAM, бинарник Chrome. PDFKit = Node-only.
- **Install:** `npm i pdfkit && npm i -D @types/pdfkit` · [github.com/foliojs/pdfkit](https://github.com/foliojs/pdfkit)
- **Проверка:** PDF открывается у 5 импортёров (RICE#9); кириллица (свой TTF в `data/fonts/`); admin `warranty.pdf` под auth.
- **Риски:** без живых цифр опта PDF бесполезен — сначала решение владельца по сетке.

### 3. `posthog-js` (A/E) — AUDIT: гарантия / бандлы

- **Что:** cloud free flags: `guarantee_12m` vs «6+OTA», `bundle_sku` (Меню / +Yandex / +OTA).
- **Почему не Prepr:** CMS+A/B ради 2 гипотез — overkill.
- **Почему не Umami/Plausible как «вторая Метрика»:** Метрика+GTM уже на проде; `/api/events` закрывает first-party до cookie. Нужны **флаги**, не третий pageview. Umami — §3.3.
- **Install:** `npm i posthog-js` · [github.com/PostHog/posthog-js](https://github.com/PostHog/posthog-js)
- **Проверка:** 50/50 `guarantee_12m` × `form_success` / lead→confirm за 14 дней (AUDIT §7#10).
- **Риски:** грузить после cookie accept; self-host PostHog на hoster — нет (RAM, §3.5).

### 4. `astro-seo-audit` (A) — AUDIT: SERP / SEO-страницы

- **Что:** регулярный прогон title/description/canonical/OG на `/`, `/cena`, `/sravnenie`, model pages.
- **Почему не `@arraypress/seo-astro` / `astro-seo-toolkit`:** генераторы дублируют живой `seo.ts`+sitemap.
- **Install:** `npm i -D astro-seo-audit` · [github.com/namanlabc/astro-seo-audit](https://github.com/namanlabc/astro-seo-audit)
- **Проверка:** 0 critical missing; карточки Maps — **отдельно руками** (не npm).
- **Риски:** пакет 0.3.x — ложные алерты на SSR; не автоfix в CI.

### 5. `p-retry` (D) — AUDIT: OTA remind / show-up

- **Что:** wrapper `callApi`: backoff на 429/5xx; лёгкий rate limit ~25 msg/s.
- **Почему не grammY (`ratelimiter`/`auto-retry`/`conversations`) / aiogram-\*:** бот — свой FSM на webhook+SQLite. Миграция >900 строк ради плагинов. aiogram = Python.
- **Install:** `npm i p-retry` · [github.com/sindresorhus/p-retry](https://github.com/sindresorhus/p-retry)
- **Проверка:** mock 429 → notify доходит; −24ч/−2ч и OTA 14/7/3 не теряются молча.
- **Риски:** не ретраить 400; идемпотентность по `orderId`.

### 6. `web-vitals` (A/I) — AUDIT: mobile calc

- **Что:** LCP/INP/CLS → `/api/events` с path (+ sample 10–20%).
- **Почему не сразу `@casoon/astro-webvitals`:** меньше магии под cookie-gate; Casoon — запасной Astro-integration.
- **Install:** `npm i web-vitals` · [github.com/GoogleChrome/web-vitals](https://github.com/GoogleChrome/web-vitals)
- **Проверка:** события `cwv_*` на `/` и `/#booking` с mobile UA.
- **Риски:** только после cookie accept (как Метрика).

### 7–9. Cursor skills (G)

| Skill | Repo | Gap AUDIT |
| --- | --- | --- |
| `cro-methodology` | [wondelai/skills](https://github.com/wondelai/skills/tree/main/cro-methodology) | Доверие, кейсы, гарантия, banner |
| `seo-audit` + `schema` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | SERP, model FAQ, LocalBusiness |
| `release-it` | [wondelai/skills](https://github.com/wondelai/skills) | Retry/timeout TG и публичных API |

- **Почему не `nurosys-agents` целиком:** agent-OS/Serena — тяжело, мимо 14-дневного рычага.  
- **Почему не весь skill-brain / roberts-skills каталогом:** 2–3 skills под P0; остальное потом.  
- **Проверка:** `/cro-methodology` → ≥3 гипотезы с метрикой `form_success`/`calc_open`, не «улучшить UX».  
- **Риски:** skills ≠ живые цели в UI Метрики — завести `booking_success`/`calc_open` (AUDIT §7).

### 10. `schema-dts` (H)

- **Что:** типы для существующих билдеров JSON-LD.
- **Почему не Schema Builder / one-shot plugin:** LocalBusiness/FAQ/HowTo уже на проде; нужен typecheck, не новый генератор.
- **Install:** `npm i -D schema-dts` · [github.com/google/schema-dts](https://github.com/google/schema-dts)
- **Проверка:** Rich Results Test `/` + model; `astro check` без регрессий.
- **Риски:** само по себе позиций не даст — Maps + кейсы важнее.

### 11. `@lhci/cli` (I)

- **Что:** Lighthouse CI бюджеты после заливки кейсов.
- **Почему не Sentry/Datadog:** рано (J); шум > пользы при 10 заказах/мес.
- **Install:** `npm i -D @lhci/cli` · [github.com/GoogleChrome/lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci)
- **Проверка:** `/` и одна model page; LCP mobile бюджет после WebP.
- **Риски:** flaky на shared host; 1–3 URL в CI, не 55 моделей.

### 12. `unlighthouse` (I)

- **Что:** ночной скан sitemap `/auto/*`.
- **Install:** `npx unlighthouse --site https://mova-auto.tech` · [github.com/harlan-zw/unlighthouse](https://github.com/harlan-zw/unlighthouse)
- **Проверка:** топ тяжёлых URL пофиксен или отложен.
- **Риски:** throttle; не долбить прод днём.

### 13. PSI + DevTools MCP (I)

- **Что:** разбор LCP (image/font) после `sharp`.
- **Почему не astro-edge:** hoster.by без edge runtime; смена хостинга не в scope 14 дней.
- **Проверка:** повтор PSI mobile до/после кейсов.
- **Риски:** lab ≠ RUM — сверять с `web-vitals`.

### 14. `motion` (B) — опц. P2

- **Что:** микроfeedback ошибок/успеха в React-островах.
- **Почему не GSAP Flip/SplitText/ScrollTrigger/Lottie/Rive:** hero уже лёгкий GSAP без ScrollTrigger; Lenis только desktop+fine pointer. Flip/SplitText — лишний вес. Lottie/Rive — нет дизайна.
- **Install:** `npm i motion` · [github.com/motiondivision/motion](https://github.com/motiondivision/motion)
- **Проверка:** +≤15 KB gzip island; `prefers-reduced-motion` off.
- **Риски:** не трогать, пока SampleBanner/кейсы/OTA-drop/PDF не закрыты.

---

## 3.3 Отвергнуто

| Кандидат | Кат. | Почему |
| --- | --- | --- |
| `@arraypress/seo-astro`, `astro-seo-toolkit` | A | Дубль `seo.ts` |
| `astro-imagetools`, `@astrojs/image` | A | Не закрывают admin cases upload |
| Prepr | A | CMS ради 2 A/B |
| AstroWind / AstroDeck / ScrewFast | A | Только inspo; не ставить стартер на прод |
| GSAP Flip / SplitText / ScrollTrigger everywhere | B | Hero ок; Lenis уже ограничен |
| Lottie / Rive | B | Нет ассетов дизайнера |
| Prisma | C | Drizzle+SQLite на hoster достаточно |
| `node:sqlite` сейчас | C | Эксперимент; `better-sqlite3` стабилен |
| grammY / telegraf / aiogram-* | D | Свой FSM; миграция ≠ выгода |
| Umami / Plausible (основной) | E | Метрика+GTM+`/api/events` живы; третий счётчик = шум. PostHog — только flags |
| Self-host PostHog на hoster | E | Нужен VPS ≥4–8 GB позже |
| Puppeteer PDF | F | Тяжело для shared hosting |
| Schema Builder / тяжёлый schema-plugin | H | JSON-LD уже есть |
| Sentry / Datadog early | J/I | LHCI + логи hoster |
| GraphQL / tRPC | J | REST `/api/*` хватает |
| Strapi | J | Своя админка + SQLite cases |
| K8s / Kafka / Redis cluster / Docker Swarm | J | 2 человека, ~10–30 заказов/мес |

**C — решение:** остаёмся на **Drizzle + better-sqlite3**. Postgres из `db:migrate:pg` — только если упрётесь в бэкап/2 инстанса; не блокер конверсии (AUDIT §4.5.6 = ops, не воронка).

---

## 3.4 План 14 дней (тулзы × AUDIT RICE)

| День | Действие | Тулзы | Done = |
| ---: | --- | --- | --- |
| 1 | Снять SampleBanner с прода; цели Метрики в UI | — (продукт) | banner impressions = 0 |
| 1 | Skills CRO + SEO + release-it | #7–9 | в Cursor picker |
| 2 | `p-retry` на Telegram | #5 | 429 не глотает notify |
| 2–4 | `sharp` + 8 своих до/после в CMS | #1 | `#cases` на проде; RICE#2 |
| 3–5 | Опт-PDF + 5 созвонов импортёрам | #2 | ≥1 пилот в пайплайне |
| 4–5 | `astro-seo-audit` + skill seo-audit | #4 #8 | P0 meta закрыты |
| 5–6 | Карты Я/G/2ГИС (руками) | — | entity + NAP |
| 6–7 | `web-vitals` → events | #6 | RUM mobile `/` |
| 5–8 | PostHog: guarantee + bundle flags | #3 | ≥100 exposure или 7 дней |
| 7 | Не сбрасывать OTA calc→booking | — (продукт) | ota_attach ↑ |
| 8–10 | Warranty PDF + OTA remind надёжность | #2 #5 | PDF из админки; remind delivery |
| 10–11 | LHCI бюджеты | #11 | CI зелёный на `/` |
| 12 | Unlighthouse `/auto/*` | #12 | топ-10 тяжёлых |
| 13–14 | PSI/MCP + решение по `motion` | #13 #14 | отчёт: что оставить |

Параллельно (не тулзы, но AUDIT P0): Kufar, Директ на `/auto/...`, inbox «сегодня», УНП в футере.

---

## 3.5 Бюджет

| Статья | Модель | USD/мес | ≈ BYN/мес* | RAM |
| --- | --- | ---: | ---: | --- |
| PostHog Cloud free | flags + limited events | 0 | 0 | 0 (SaaS) |
| Метрика / GTM | уже | 0 | 0 | 0 |
| npm (sharp, pdfkit, p-retry, web-vitals, schema-dts, motion, LHCI, astro-seo-audit) | OSS | 0 | 0 | +50–150 MB пик на app |
| Unlighthouse / PSI / skills | free | 0 | 0 | локально |
| Self-host PostHog | **не сейчас** | VPS 10–20+ | 30–70 | **≥4–8 GB** |
| Sentry Team | **не сейчас** | ~26 | ~85 | 0 |
| Реклама (AUDIT, не тулзы) | Директ+Kufar+VK retarget | — | **700–1200** мес 1 | — |

\*Пересчёт по НБРБ на день оплаты.

**Тулзы: 0 BYN.** Время ~**40 ч** на внедрение из §3.1 + контент кейсов/опт-разговоры. Деньги роста — в каналный бюджет AUDIT, не в SaaS.

---

## A–J покрытие

| Кат. | Где |
| --- | --- |
| A SEO/images/CWV/A/B/starters | #1 #3 #4 #6; starters → §3.3 |
| B Anim | #14; Flip/Lottie → §3.3 |
| C DB | §3.3 Drizzle; Prisma нет |
| D Telegram | #5; grammY/aiogram → §3.3 |
| E Analytics | #3 PostHog flags; Umami → §3.3 |
| F PDF | #2 PDFKit |
| G Skills | #7 #8 #9 |
| H Schema | #10; heavy plugin → §3.3 |
| I Speed | #6 #11 #12 #13; edge → §3.3 |
| J NOT | §3.3 |

---

*Doc-only. Код не менялся. Источник приоритетов: `AUDIT.md` @ `e0ddd22`.*
