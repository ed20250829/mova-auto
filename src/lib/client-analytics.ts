/** Browser-side analytics: first-party /api/events + Yandex Metrika reachGoal + GTM. */

export const COOKIE_CONSENT_KEY = 'mova_cookie_consent';

declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: unknown[]) => void;
    dataLayer?: unknown[];
    __movaMetrikaId?: string;
    __movaMetrikaLoaded?: boolean;
    __movaGtmId?: string;
    __movaGtmLoaded?: boolean;
  }
}

/** Internal event name → Metrika goal id (create these goals in Metrika UI). */
const METRIKA_GOALS: Record<string, string> = {
  form_success: 'booking_success',
  callback_submit: 'callback_success',
  calc_open: 'calc_open',
  promo_apply: 'promo_apply',
};

export function readUtm() {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  return {
    utmSource: p.get('utm_source') || undefined,
    utmMedium: p.get('utm_medium') || undefined,
    utmCampaign: p.get('utm_campaign') || undefined,
  };
}

export function track(
  name: string,
  meta?: Record<string, unknown>,
  opts?: { /** Default true. Set false when the server already wrote this event. */ server?: boolean },
) {
  if (typeof window === 'undefined') return;
  if (opts?.server !== false) {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, meta, ...readUtm() }),
    });
  }
  reachGoal(name);
}

/** Goals fired before Metrika init (e.g. calc_open before cookie accept). */
const pendingGoals: string[] = [];

function flushPendingGoals(id: number) {
  if (typeof window.ym !== 'function') return;
  while (pendingGoals.length) {
    const goal = pendingGoals.shift();
    if (!goal) continue;
    try {
      window.ym(id, 'reachGoal', goal);
    } catch {
      /* ignore */
    }
  }
}

function reachGoal(eventName: string) {
  const goal = METRIKA_GOALS[eventName];
  if (!goal) return;
  const id = Number(window.__movaMetrikaId || 0);
  if (!id || typeof window.ym !== 'function') {
    pendingGoals.push(goal);
    return;
  }
  try {
    window.ym(id, 'reachGoal', goal);
  } catch {
    /* ignore */
  }
}

/** Load tag.js + init once. Call only after cookie accept (or if already accepted). */
export function loadYandexMetrika(counterId: string) {
  if (typeof window === 'undefined') return;
  const idStr = String(counterId || '').trim();
  if (!idStr) return;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return;

  window.__movaMetrikaId = idStr;
  if (window.__movaMetrikaLoaded) {
    flushPendingGoals(id);
    return;
  }
  window.__movaMetrikaLoaded = true;

  (function (m: Window, e: Document, t: string, r: string, i: string) {
    type YmFn = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
    const w = m as Window & Record<string, YmFn | undefined>;
    w[i] =
      w[i] ||
      (function (...args: unknown[]) {
        const fn = w[i] as YmFn;
        (fn.a = fn.a || []).push(args);
      } as YmFn);
    (w[i] as YmFn).l = Date.now();
    for (let j = 0; j < e.scripts.length; j++) {
      if (e.scripts[j].src === r) return;
    }
    const k = e.createElement(t) as HTMLScriptElement;
    const a = e.getElementsByTagName(t)[0];
    k.async = true;
    k.src = r;
    a?.parentNode?.insertBefore(k, a);
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

  window.ym?.(id, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
  });
  flushPendingGoals(id);
}

/** Load GTM container once. Call only after cookie accept (or if already accepted). Separate from Metrika. */
export function loadGoogleTagManager(containerId: string) {
  if (typeof window === 'undefined') return;
  const id = String(containerId || '').trim();
  if (!id || !/^GTM-[A-Z0-9]+$/i.test(id)) return;

  window.__movaGtmId = id;
  if (window.__movaGtmLoaded) return;
  window.__movaGtmLoaded = true;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
  const first = document.getElementsByTagName('script')[0];
  first?.parentNode?.insertBefore(script, first);

  // Standard noscript iframe, injected after consent (JS gate; mirrors head+body snippet).
  if (!document.getElementById('mova-gtm-ns')) {
    const iframe = document.createElement('iframe');
    iframe.id = 'mova-gtm-ns';
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(id)}`;
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    iframe.setAttribute('title', 'Google Tag Manager');
    document.body.insertBefore(iframe, document.body.firstChild);
  }
}
