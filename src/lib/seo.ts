import type { PublicModel } from './models';
import { formatByn, formatMinutes } from './format';

export const SITE_URL = 'https://mova-auto.tech';
export const SITE_PHONE_E164 = '+375447149978';
export const SITE_PHONE_DISPLAY = '+375 44 714-99-78';
export const SITE_EMAIL = 'hello@mova-auto.tech';
export const SITE_TELEGRAM = 'https://t.me/mova_auto_bot';
export const SITE_TIKTOK = 'https://www.tiktok.com/@mova_auto';
/** NAP street line for schema / footer (Parkland 1). */
export const SITE_STREET_ADDRESS = 'ул. Виталия Цвирко 78';
export const SITE_ADDRESS_EXTRA = 'Parkland 1';
export const SITE_ADDRESS_LOCALITY = 'Минск';
export const SITE_ADDRESS_COUNTRY = 'BY';
export const SITE_ADDRESS_DISPLAY = 'Parkland 1, ул. Виталия Цвирко 78, Минск';

/** Public profiles for Organization / LocalBusiness sameAs. */
export const ORGANIZATION_SAME_AS = [SITE_TELEGRAM, SITE_TIKTOK] as const;

export function postalAddressJsonLd() {
  return {
    '@type': 'PostalAddress',
    streetAddress: `${SITE_ADDRESS_EXTRA}, ${SITE_STREET_ADDRESS}`,
    addressLocality: SITE_ADDRESS_LOCALITY,
    addressCountry: SITE_ADDRESS_COUNTRY,
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'Мова',
    legalName: 'Мова',
    alternateName: ['Mova', 'Mova Auto', 'мова авто'],
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    image: `${SITE_URL}/og.png`,
    email: SITE_EMAIL,
    telephone: SITE_PHONE_E164,
    sameAs: [...ORGANIZATION_SAME_AS],
    address: postalAddressJsonLd(),
    areaServed: [
      { '@type': 'City', name: 'Минск' },
      { '@type': 'Country', name: 'Беларусь' },
    ],
  };
}

export function localBusinessJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutomotiveBusiness',
    '@id': `${SITE_URL}/#localbusiness`,
    name: 'Мова',
    alternateName: ['Mova', 'Mova Auto', 'мова авто'],
    description:
      'Русификация мультимедиа китайских авто в Минске, Беларусь. Фикс-цена в BYN, запись онлайн, страховка после обновления ПО.',
    url: SITE_URL,
    image: `${SITE_URL}/og.png`,
    email: SITE_EMAIL,
    telephone: SITE_PHONE_E164,
    sameAs: [...ORGANIZATION_SAME_AS],
    parentOrganization: { '@id': `${SITE_URL}/#organization` },
    address: postalAddressJsonLd(),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 53.9006,
      longitude: 27.559,
    },
    areaServed: [
      { '@type': 'City', name: 'Минск' },
      { '@type': 'AdministrativeArea', name: 'Минская область' },
      { '@type': 'Country', name: 'Беларусь' },
    ],
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '08:00',
      closes: '22:00',
    },
    priceRange: '450-1450 BYN',
    currenciesAccepted: 'BYN',
    paymentAccepted: 'Cash, Bank Transfer',
    availableLanguage: ['ru', 'be'],
  };
}

export function faqPageJsonLd(items: readonly { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
}

export function howToJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Как проходит русификация авто в Мове',
    description:
      'Короткий порядок работы: фото экрана, запись слота, визит в Минске, проверка меню на русском.',
    totalTime: 'PT60M',
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'BYN',
      value: '450',
    },
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Фото экрана и модель',
        text: 'Пришлите фото главного экрана и укажите марку/модель — подтвердим, что можем сделать, и покажем фикс-цену в BYN.',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Запись на слот',
        text: 'Выберите дату и время в форме на сайте или напишите в Telegram. Слоты в Минске, на связи 08:00–22:00.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Визит',
        text: 'Приезжаете на согласованное место в городе. Базовая русификация меню обычно 40–60 минут; сложные модели — до 2–3 часов.',
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Проверка экранов',
        text: 'Вместе проходим меню и настройки. При необходимости отдельно обсуждаем пакет Яндекс-приложений и страховку после обновления ПО.',
      },
    ],
  };
}

const BRAND_INTRO: Record<string, string> = {
  byd: 'Русификация BYD в Минске: Song Plus, Dolphin, Seal, Yuan Up и другие модели из прайса. Ставим русский в меню и настройках, где позволяет система DiLink. Цена фиксирована в BYN до визита — смотрите карточку модели или калькулятор.',
  geely:
    'Русификация Geely (Джили) в Минске: Monjaro, Coolray, Boyue L, Galaxy E5 и другие. Базовое меню на русском, где позволяет платформа. Фикс-цена в BYN, запись онлайн, гарантия 6 месяцев на выполненную работу.',
  zeekr:
    'Русификация Zeekr в Минске: 001, 7X, X и соседние версии из прайса. Работа сложнее mass-сегмента — закладываем больше времени. Цена и срок по модели видны до записи. Пакет приложений для Zeekr — отдельная опция.',
  'li-auto':
    'Русификация Li Auto (Lixiang) в Минске: L6, L7, L8, L9. Меню и настройки переводим там, где система даёт доступ. Фикс в BYN, слот онлайн. Для Li пакет приложений и страховка после обновления ПО считаются отдельно.',
  deepal:
    'Русификация Deepal в Минске: S07, S05, SL03. Базовое меню на русском, где позволяет система. Цены в BYN по каждой модели — в карточках ниже и в калькуляторе на главной.',
  voyah:
    'Русификация Voyah в Минске: Free, Dreamer и соседние версии из прайса. Фикс-цена базы, понятный срок, запись без скрытых доплат на месте.',
  changan:
    'Русификация Changan в Минске: UNI-K, UNI-T, CS75 Plus и другие модели из базы. Меню и настройки — где позволяет система. Цена в BYN до визита.',
  leapmotor:
    'Русификация Leapmotor в Минске: C11, C10, C16 и другие. Базовая русификация меню с фикс-ценой в BYN. Запись онлайн, работа в Минске.',
  avatr:
    'Русификация Avatr в Минске. Модель из прайса — с отдельной ценой и сроком. База — меню и настройки; пакет приложений для Avatr считается отдельно.',
  exeed:
    'Русификация Exeed в Минске: TXL, VX и соседние версии из прайса. Фикс в BYN, запись онлайн, гарантия 6 месяцев на выполненную русификацию меню.',
  omoda:
    'Русификация Omoda в Минске: C5, S5. Базовое меню на русском, где позволяет система. Цена и время — в карточках моделей.',
  jetour:
    'Русификация Jetour в Минске: X70, Dashing. Фикс-цена в BYN, слот онлайн, работа в городе без скрытых доплат на месте.',
};

export function brandIntro(brandSlug: string, brand: string): string {
  return (
    BRAND_INTRO[brandSlug] ||
    `Русификация ${brand} в Минске. Базовое меню и настройки на русском, где позволяет система. Фикс-цена в BYN, запись онлайн, гарантия 6 месяцев.`
  );
}

export function brandFaq(brand: string, models: PublicModel[]) {
  const minPrice = Math.min(...models.map((m) => m.priceBase));
  const sample = models.slice(0, 3).map((m) => m.model).join(', ');
  return [
    {
      q: `Сколько стоит русификация ${brand} в Минске?`,
      a: `От ${formatByn(minPrice)} за базовое меню — зависит от модели. Точная фикс-цена в BYN видна в карточке модели и в калькуляторе. Пакет Яндекс-приложений и страховка после обновления ПО считаются отдельно.`,
    },
    {
      q: `Какие модели ${brand} вы русифицируете?`,
      a: `В прайсе сейчас: ${models.map((m) => m.model).join(', ')}. Если вашей версии нет в списке — напишите фото экрана, подскажем, можем ли взять в работу.`,
    },
    {
      q: `Сколько занимает русификация ${brand}?`,
      a: `Обычно от ${formatMinutes(Math.min(...models.map((m) => m.timeMinutes)))} до ${formatMinutes(Math.max(...models.map((m) => m.timeMinutes)))} по модели. Точное время — в карточке и в калькуляторе до записи.`,
    },
    {
      q: `Что входит в базу для ${brand}?`,
      a: `Меню и настройки мультимедиа на русском — где позволяет система. Не ремонт авто и не обещание приложений, которые платформа не пускает. Примеры в прайсе: ${sample}.`,
    },
    {
      q: `Где делают русификацию ${brand}?`,
      a: `${SITE_ADDRESS_DISPLAY}. Клиент приезжает на согласованный слот. Выезд по городу — отдельная опция. На связи 08:00–22:00, телефон ${SITE_PHONE_DISPLAY}.`,
    },
  ] as const;
}

export function modelFaq(item: PublicModel) {
  return [
    {
      q: `Сколько стоит русификация ${item.brand} ${item.model} в Минске?`,
      a: `Базовая русификация меню — ${formatByn(item.priceBase)}. Фиксированная цена в BYN до визита. Пакет Яндекс-приложений, страховка после обновления ПО и выезд считаются отдельно в калькуляторе.`,
    },
    {
      q: `Сколько времени занимает ${item.brand} ${item.model}?`,
      a: `Ориентир ~${formatMinutes(item.timeMinutes)}. Сложность: ${item.complexity === 'hard' ? 'выше среднего' : item.complexity === 'easy' ? 'проще среднего' : 'средняя'}. Точное окно слота согласуем при записи.`,
    },
    {
      q: `Что входит в русификацию ${item.model}?`,
      a: `База — меню и настройки системы, где позволяет платформа${item.screenType ? ` (${item.screenType})` : ''}. Приложения и страховка после обновления ПО — отдельные опции, не входят в базовую цену автоматически.`,
    },
    {
      q: `Есть ли гарантия на ${item.brand} ${item.model}?`,
      a: `6 месяцев на выполненную русификацию меню. Не покрывает последствия сторонних прошивок и вмешательств без согласования. Страховка после обновления ПО — отдельная подписка.`,
    },
    {
      q: `Как записаться на ${item.model} в Минске?`,
      a: `Через форму на этой странице или на главной: модель уже можно выбрать заранее. Или напишите в Telegram / позвоните ${SITE_PHONE_DISPLAY}.`,
    },
  ] as const;
}

export function brandHubUrls(models: { brandSlug: string }[]): string[] {
  const slugs = [...new Set(models.map((m) => m.brandSlug))];
  return slugs.map((slug) => `${SITE_URL}/auto/${slug}`);
}
