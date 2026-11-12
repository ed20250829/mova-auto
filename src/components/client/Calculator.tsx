import { useEffect, useMemo, useState } from 'react';
import ShareButton from './ShareButton';
import { CALC_OPTIONS_STORAGE_KEY, PRICING_OPTIONS, computeOrderPrice } from '../../lib/pricing';

export type CalcModel = {
  id: number;
  brand: string;
  brandSlug: string;
  model: string;
  modelSlug: string;
  priceBase: number;
  timeMinutes: number;
  complexity: string;
  requiresOtaSubscription: boolean;
  notes: string | null;
};

type Props = {
  models: CalcModel[];
  initialBrand?: string;
  initialModelId?: number;
  /** On model SEO pages: brand/model change navigates to matching `/auto/...` */
  syncRoute?: boolean;
};

function readUtm() {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  return {
    utmSource: p.get('utm_source') || undefined,
    utmMedium: p.get('utm_medium') || undefined,
    utmCampaign: p.get('utm_campaign') || undefined,
  };
}

function track(name: string, meta?: Record<string, unknown>) {
  const utm = readUtm();
  void fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, meta, ...utm }),
  });
}

function modelPath(m: CalcModel) {
  return `/auto/${m.brandSlug}/${m.modelSlug}`;
}

function goToModel(m: CalcModel) {
  const path = modelPath(m);
  if (typeof window === 'undefined') return;
  if (window.location.pathname === path) return;
  const navigate = () => {
    window.location.assign(path);
  };
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    (
      document as Document & { startViewTransition: (cb: () => void) => void }
    ).startViewTransition(navigate);
    return;
  }
  navigate();
}

function useTickPrice(value: number) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplay(value);
      return;
    }
    let current = display;
    const start = current;
    const delta = value - start;
    if (delta === 0) return;
    const t0 = performance.now();
    const dur = 260;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      current = Math.round(start + delta * eased);
      setDisplay(current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick from last painted value
  }, [value]);

  return display;
}

export default function Calculator({
  models,
  initialBrand,
  initialModelId,
  syncRoute = false,
}: Props) {
  const brands = useMemo(() => [...new Set(models.map((m) => m.brand))], [models]);
  const [brand, setBrand] = useState(initialBrand || brands[0] || '');
  const brandModels = useMemo(() => models.filter((m) => m.brand === brand), [models, brand]);
  const [modelId, setModelId] = useState<number>(
    initialModelId || brandModels[0]?.id || models[0]?.id || 0,
  );
  // OTA recommended for every model — on by default from first paint (not only after effect).
  const [ota, setOta] = useState(false);
  const [appPack, setAppPack] = useState(false);
  const [visit, setVisit] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    value: number;
    kind: string;
    message: string;
  } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);

  const selected = models.find((m) => m.id === modelId) || brandModels[0];

  const orderedBrands = useMemo(() => {
    if (!brand) return brands;
    return [brand, ...brands.filter((b) => b !== brand)];
  }, [brands, brand]);

  useEffect(() => {
    track('calc_open');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const fromQuery = (p.get('promo') || '').trim().toUpperCase();
    if (fromQuery) {
      setPromoInput(fromQuery);
      void applyPromo(fromQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount for ?promo=
  }, []);

  useEffect(() => {
    if (!brandModels.some((m) => m.id === modelId) && brandModels[0]) {
      setModelId(brandModels[0].id);
    }
  }, [brand, brandModels, modelId]);

  const quote = useMemo(() => {
    if (!selected) return null;
    return computeOrderPrice(selected.priceBase, {
      ota,
      visit,
      appPack,
      promoCode: appliedPromo?.code || null,
      promoPercent: appliedPromo?.kind === 'percent' ? appliedPromo.value : null,
      promoFixed: appliedPromo?.kind === 'fixed' ? appliedPromo.value : null,
    });
  }, [selected, ota, visit, appPack, appliedPromo]);

  const tickPrice = useTickPrice(quote?.price ?? 0);

  async function applyPromo(codeOverride?: string) {
    const code = (codeOverride ?? promoInput).trim().toUpperCase();
    setPromoBusy(true);
    setPromoError('');
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, source: 'calculator', ...readUtm() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setAppliedPromo(null);
        setPromoError(data.error || 'Код не найден');
        return;
      }
      setAppliedPromo({
        code: data.code,
        value: data.value,
        kind: data.kind,
        message: data.message,
      });
      setPromoInput(data.code);
    } catch {
      setPromoError('Не удалось проверить код');
    } finally {
      setPromoBusy(false);
    }
  }

  function clearPromo() {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError('');
  }

  function selectBrand(nextBrand: string) {
    track('calc_model_select', { brand: nextBrand });
    setOta(false);
    if (syncRoute) {
      const first = models.find((m) => m.brand === nextBrand);
      if (first) goToModel(first);
      return;
    }
    setBrand(nextBrand);
  }

  function selectModel(id: number) {
    const m = models.find((x) => x.id === id);
    track('calc_model_select', { modelId: id, label: m ? `${m.brand} ${m.model}` : id });
    setOta(false);
    if (syncRoute && m) {
      goToModel(m);
      return;
    }
    setModelId(id);
  }

  if (!selected || !quote) {
    return <p className="muted">Модели пока не загружены.</p>;
  }

  return (
    <div className="surface calc" data-calc-root>
      <div className="calc-head">
        <div>
          <p className="kicker">Калькулятор</p>
          <h2 className="display calc-title">Цена за 60 секунд</h2>
        </div>
        <span className="chip">Без звонков</span>
      </div>

      <div className="calc-brands" role="tablist" aria-label="Марка">
        {orderedBrands.map((b) => {
          const active = b === brand;
          return (
            <button
              key={b}
              type="button"
              role="tab"
              aria-selected={active}
              className={`calc-brand ${active ? 'is-active' : ''}`}
              onClick={() => selectBrand(b)}
            >
              {b}
            </button>
          );
        })}
      </div>

      <label className="calc-field">
        <span className="calc-label">Модель</span>
        <select
          className="calc-select"
          value={selected.id}
          onChange={(e) => selectModel(Number(e.target.value))}
        >
          {brandModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.model} - {m.priceBase} BYN · {m.timeMinutes} мин
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="calc-missing muted"
        data-callback-trigger="model_missing"
        onClick={() => {
          window.dispatchEvent(
            new CustomEvent('mova:callback', { detail: { trigger: 'model_missing' } }),
          );
        }}
      >
        Моей модели нет в списке →
      </button>

      <div className="calc-options" role="group" aria-label="Опции">
        <div className="calc-opt calc-opt--locked">
          <span className="calc-opt-main">
            <strong>Базовая русификация</strong>
            <span className="muted">меню и настройки · в цене</span>
          </span>
        </div>

        <label className={`calc-opt ${ota ? 'is-on' : ''}`}>
          <input
            type="checkbox"
            checked={ota}
            onChange={(e) => {
              setOta(e.target.checked);
              track('calc_option_toggle', { option: 'ota', on: e.target.checked });
            }}
          />
          <span className="calc-opt-main">
            <strong>OTA-страховка</strong>
            <span className="muted">сброс языка после обновления</span>
          </span>
          <span className="calc-opt-price">+{PRICING_OPTIONS.otaInsurance} BYN/год</span>
        </label>

        <label className={`calc-opt ${appPack ? 'is-on' : ''}`}>
          <input
            type="checkbox"
            checked={appPack}
            onChange={(e) => {
              setAppPack(e.target.checked);
              track('calc_option_toggle', { option: 'app_pack', on: e.target.checked });
            }}
          />
          <span className="calc-opt-main">
            <strong>Яндекс-приложения</strong>
            <span className="muted">Алиса, Карты, Музыка · где позволяет система</span>
          </span>
          <span className="calc-opt-price">уточним</span>
        </label>

        <label className={`calc-opt ${visit ? 'is-on' : ''}`}>
          <input
            type="checkbox"
            checked={visit}
            onChange={(e) => {
              setVisit(e.target.checked);
              track('calc_option_toggle', { option: 'visit', on: e.target.checked });
            }}
          />
          <span className="calc-opt-main">
            <strong>Выезд</strong>
            <span className="muted">Минск, по слоту</span>
          </span>
          <span className="calc-opt-price">+{PRICING_OPTIONS.onSiteVisit} BYN</span>
        </label>
      </div>

      <div className="calc-promo">
        <span className="calc-label">Промокод</span>
        <div className="calc-promo-row">
          <input
            className="calc-select"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
            placeholder="Если есть код"
            aria-label="Промокод"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void applyPromo();
              }
            }}
          />
          {appliedPromo ? (
            <button type="button" className="btn btn-ghost" onClick={clearPromo}>
              Сбросить
            </button>
          ) : (
            <button type="button" className="btn" disabled={promoBusy || !promoInput.trim()} onClick={() => void applyPromo()}>
              {promoBusy ? '…' : 'Применить'}
            </button>
          )}
        </div>
        {appliedPromo && <p className="calc-promo-ok muted">{appliedPromo.message}</p>}
        {promoError && (
          <p className="calc-promo-err" role="status">
            {promoError}
          </p>
        )}
      </div>

      <div className="calc-total" aria-live="polite">
        <div>
          <p className="calc-total-label">
            Итого · {selected.brand} {selected.model} · ~{selected.timeMinutes} мин
          </p>
          <p className="display calc-total-price">{tickPrice}&nbsp;BYN</p>
          <p className="calc-total-layers muted">
            база
            {ota ? ' · OTA' : ''}
            {appPack ? ' · Яндекс-приложения' : ''}
            {visit ? ' · выезд' : ''}
            {appliedPromo ? ` · −${appliedPromo.kind === 'percent' ? `${appliedPromo.value}%` : `${appliedPromo.value} BYN`}` : ''}
            {quote.discount > 0 ? ` · было ${quote.subtotal} BYN` : ''}
          </p>
        </div>
        <div className="calc-total-actions">
          <ShareButton price={quote.price} modelLabel={`${selected.brand} ${selected.model}`} />
          <a
            className="btn"
            href="#booking"
            onClick={() => {
              try {
                sessionStorage.setItem(
                  CALC_OPTIONS_STORAGE_KEY,
                  JSON.stringify({
                    modelId: selected.id,
                    ota,
                    visit,
                    appPack,
                    promo: appliedPromo?.code || '',
                    promoValue: appliedPromo?.value,
                    promoKind: appliedPromo?.kind,
                  }),
                );
              } catch {
                /* ignore quota */
              }
              track('cta_click', {
                from: 'calculator',
                modelId: selected.id,
                price: quote.price,
                ota,
                appPack,
                visit,
                promo: appliedPromo?.code || null,
              });
            }}
          >
            Записаться
          </a>
        </div>
      </div>

      {selected.notes && <p className="calc-note muted">{selected.notes}</p>}

      {!syncRoute && (
        <a className="calc-model-link muted" href={modelPath(selected)}>
          Карточка модели →
        </a>
      )}
    </div>
  );
}
