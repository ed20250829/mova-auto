import { useEffect, useMemo, useState } from 'react';
import ShareButton from './ShareButton';
import { CALC_OPTIONS_STORAGE_KEY, PRICING_OPTIONS } from '../../lib/pricing';

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
  // Soft-ish: View Transition when available, else full route load (SSR left panel + SEO URL).
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
  const [ota, setOta] = useState(false);
  const [appPack, setAppPack] = useState(false);
  const [visit, setVisit] = useState(false);
  const [promo, setPromo] = useState(false);

  const selected = models.find((m) => m.id === modelId) || brandModels[0];

  const orderedBrands = useMemo(() => {
    if (!brand) return brands;
    return [brand, ...brands.filter((b) => b !== brand)];
  }, [brands, brand]);

  useEffect(() => {
    track('calc_open');
  }, []);

  useEffect(() => {
    if (!brandModels.some((m) => m.id === modelId) && brandModels[0]) {
      setModelId(brandModels[0].id);
    }
  }, [brand, brandModels, modelId]);

  useEffect(() => {
    if (selected?.requiresOtaSubscription) setOta(true);
  }, [selected?.id, selected?.requiresOtaSubscription]);

  const price = useMemo(() => {
    if (!selected) return 0;
    let total = selected.priceBase;
    if (ota) total += PRICING_OPTIONS.otaInsurance;
    if (visit) total += PRICING_OPTIONS.onSiteVisit;
    if (promo) total = Math.round(total * (1 - PRICING_OPTIONS.promoMova10Percent / 100));
    return total;
  }, [selected, ota, visit, promo]);

  const tickPrice = useTickPrice(price);

  function selectBrand(nextBrand: string) {
    track('calc_model_select', { brand: nextBrand });
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
    if (syncRoute && m) {
      goToModel(m);
      return;
    }
    setModelId(id);
  }

  if (!selected) {
    return <p className="muted">Модели пока не загружены.</p>;
  }

  return (
    <div className="surface calc">
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
              {m.model} — {m.priceBase} BYN · {m.timeMinutes} мин
            </option>
          ))}
        </select>
      </label>

      <div className="calc-options" role="group" aria-label="Опции">
        <div className="calc-opt calc-opt--locked">
          <span className="calc-opt-main">
            <strong>Базовая русификация</strong>
            <span className="muted">меню / настройки · в цене</span>
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

        <label className={`calc-opt ${promo ? 'is-on' : ''}`}>
          <input
            type="checkbox"
            checked={promo}
            onChange={(e) => {
              setPromo(e.target.checked);
              track('calc_option_toggle', { option: 'mova10', on: e.target.checked });
            }}
          />
          <span className="calc-opt-main">
            <strong>MOVA10</strong>
            <span className="muted">промокод</span>
          </span>
          <span className="calc-opt-price">−10%</span>
        </label>
      </div>

      <div className="calc-total" aria-live="polite">
        <div>
          <p className="calc-total-label">
            Итого · {selected.brand} {selected.model} · ~{selected.timeMinutes} мин
          </p>
          <p className="display calc-total-price">
            {tickPrice}&nbsp;BYN
          </p>
          <p className="calc-total-layers muted">
            база
            {ota ? ' · OTA' : ''}
            {appPack ? ' · Яндекс-приложения' : ''}
            {visit ? ' · выезд' : ''}
            {promo ? ' · −10%' : ''}
          </p>
        </div>
        <div className="calc-total-actions">
          <ShareButton price={price} modelLabel={`${selected.brand} ${selected.model}`} />
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
                    promo: promo ? 'MOVA10' : '',
                  }),
                );
              } catch {
                /* ignore quota */
              }
              track('cta_click', {
                from: 'calculator',
                modelId: selected.id,
                price,
                ota,
                appPack,
                visit,
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
