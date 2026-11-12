import { eq } from 'drizzle-orm';
import { db } from '../db';
import { orders } from '../db/schema';
import { getAllModels, getBrands, getRawModel } from './models';
import { PRICING_OPTIONS } from './pricing';
import { getFreeSlots, occupiedSlots } from './slots';
import {
  answerCallbackQuery,
  btn,
  editMessageText,
  findBridge,
  findOrdersForClient,
  formatSlotLabel,
  getTelegramUser,
  inlineKeyboard,
  isOwnerChat,
  normalizeUsername,
  notifyClientStatus,
  notifyOwnerBooking,
  ownerChatId,
  parseDraft,
  saveBridge,
  sendMessage,
  setUserState,
  siteAddress,
  sitePhone,
  siteUrl,
  statusMessageForClient,
  todayIso,
  addDaysIso,
  upsertTelegramUser,
  urlBtn,
  digitsOnly,
} from './telegram';

type TgUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TgMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  contact?: { phone_number: string; first_name?: string };
  photo?: { file_id: string }[];
  reply_to_message?: { message_id: number; from?: TgUser };
};

type TgCallback = {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
};

type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallback;
};

function mainMenuKeyboard() {
  return inlineKeyboard([
    [btn('Записаться', 'menu:book')],
    [btn('Узнать цену', 'menu:price')],
    [btn('Страховка обновлений', 'menu:ota')],
    [btn('Мои заказы', 'menu:orders')],
    [btn('Связаться с человеком', 'menu:human')],
  ]);
}

function backHomeRow() {
  return [btn('← Назад', 'menu:home')];
}

async function sendHome(chatId: string, firstName?: string | null) {
  const name = firstName ? `, ${firstName}` : '';
  await sendMessage(
    chatId,
    `Здравствуйте${name}. Это Мова — русификация китайских авто в Минске. 40–60 минут, фикс-цена, гарантия 6 месяцев.\n\nЧто нужно?`,
    { replyMarkup: mainMenuKeyboard() },
  );
  setUserState(chatId, 'idle', {});
}

function chunkButtons<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function nextDates(count = 6): string[] {
  const out: string[] = [];
  let i = 0;
  while (out.length < count && i < 21) {
    const iso = addDaysIso(i);
    const day = new Date(`${iso}T12:00:00`).getDay();
    // Prefer weekends + evenings-friendly weekdays; still show next calendar days
    if (i === 0 || day === 0 || day === 6 || day >= 1) out.push(iso);
    i += 1;
  }
  return out.slice(0, count);
}

function isValidPhone(phone: string) {
  const digits = digitsOnly(phone);
  return digits.length >= 9 && digits.length <= 15;
}

function isLikelyName(text: string) {
  const t = text.trim();
  if (t.length < 2 || t.length > 40) return false;
  if (/^\d+$/.test(t)) return false;
  return /[A-Za-zА-Яа-яЁё]/.test(t);
}

const FAQ: { re: RegExp; answer: string }[] = [
  {
    re: /голос|ассистент|алиса|сири/i,
    answer:
      'Меню, навигация и настройки — на русском. Для русского голоса ставим Алису и приложения, где система позволяет. Если важно именно это — напишите, обсудим.',
  },
  {
    re: /слетит|ota|обновлен|прошивк/i,
    answer:
      'На некоторых моделях русский может слететь после обновления ПО авто. Для этого есть страховка обновлений: восстановление бесплатно и приоритетно.',
  },
  {
    re: /сколько.*(врем|час|минут)|как долго|по времени/i,
    answer: 'BYD и Changan — 40–60 минут. Geely — 60–90. Zeekr и Li Auto — до 2–3 часов. Точное время видно при выборе модели.',
  },
  {
    re: /гарант.*дилер|дилер.*гарант/i,
    answer:
      'Честно: вмешательство в прошивку может быть основанием для отказа в гарантии на мультимедиа. Уточните у дилера заранее. Мы говорим об этом до работы, не после.',
  },
  {
    re: /дорого|почему так|за 400/i,
    answer:
      'За 400 часто делают без резервной копии и без гарантии. У нас цена фиксированная, копия снимается до работы, гарантия 6 месяцев. Если что-то пойдёт не так — восстановим.',
  },
  {
    re: /сегодня|сейчас.*(можно|есть)/i,
    answer: `Если на сегодня есть слот — увидите его в «Записаться». Если нет — ближайшие дни там же. Срочно: ${sitePhone()}.`,
  },
  {
    re: /суббот|воскресен|выходн/i,
    answer: 'Да, суббота и воскресенье — основные дни. Вечера будних — тоже, начиная с 18:00.',
  },
  {
    re: /оплат|карт|перевод|налич/i,
    answer: 'Да, картой, переводом или наличными. Оплата после работы — предоплата не нужна.',
  },
  {
    re: /где вы|адрес|минск|куда ехать|локац/i,
    answer: `Да, Минск. ${siteAddress()}. Парковка есть.`,
  },
  {
    re: /слома|после прошив|если что/i,
    answer:
      'До работы снимаем полную резервную копию. Если что-то пойдёт не так — восстановим из неё. Именно поэтому не берём блоки, по которым нет оригинального файла.',
  },
  {
    re: /официально|договор|ип|чек/i,
    answer:
      'Да, работаем через ИП. Оплата после работы, гарантия 6 месяцев, чек по запросу. Если нужен договор — напишите человеку, подготовим.',
  },
  {
    re: /zeekr|зикр/i,
    answer: 'Zeekr — обычно 1 300–1 600 BYN в зависимости от модели, 2–3 часа. Точная цена при выборе модели в записи.',
  },
];

function matchFaq(text: string): string | null {
  for (const item of FAQ) {
    if (item.re.test(text)) return item.answer;
  }
  return null;
}

async function startBooking(chatId: string) {
  const brands = getBrands();
  const buttons = chunkButtons(
    brands.slice(0, 8).map((b) => btn(b, `book:brand:${encodeURIComponent(b)}`)),
    2,
  );
  buttons.push([btn('Другая', 'book:brand:__other__')]);
  buttons.push(backHomeRow());
  setUserState(chatId, 'book_brand', {});
  await sendMessage(chatId, 'Какая у вас машина?', { replyMarkup: inlineKeyboard(buttons) });
}

async function askModels(chatId: string, brand: string) {
  const models = getAllModels().filter((m) => m.brand === brand);
  if (!models.length) {
    setUserState(chatId, 'book_other_brand', {});
    await sendMessage(chatId, 'Напишите марку и модель текстом — передадим человеку.', {
      replyMarkup: inlineKeyboard([backHomeRow()]),
    });
    return;
  }
  const buttons = chunkButtons(
    models.slice(0, 10).map((m) => btn(m.model, `book:model:${m.id}`)),
    2,
  );
  buttons.push([btn('Другая модель', 'book:model:other')]);
  buttons.push([btn('← Назад', 'book:back:brand')]);
  setUserState(chatId, 'book_model', { brand });
  await sendMessage(chatId, `Какая модель ${brand}?`, { replyMarkup: inlineKeyboard(buttons) });
}

async function askDates(chatId: string, draft: Record<string, unknown>) {
  const dates = nextDates(6);
  const buttons = chunkButtons(
    dates.map((d) => btn(formatSlotLabel(d), `book:date:${d}`)),
    2,
  );
  buttons.push([btn('← Назад', 'book:back:model')]);
  setUserState(chatId, 'book_date', draft);
  await sendMessage(chatId, 'Когда удобно? Свободные дни:', { replyMarkup: inlineKeyboard(buttons) });
}

async function askSlots(chatId: string, draft: Record<string, unknown>, date: string) {
  const free = getFreeSlots(date);
  if (!free.length) {
    await sendMessage(chatId, 'На этот день слотов нет. Выберите другой день.', {
      replyMarkup: inlineKeyboard([[btn('← Назад', 'book:back:date')]]),
    });
    return;
  }
  const buttons = chunkButtons(
    free.map((s) => btn(s, `book:slot:${s}`)),
    2,
  );
  buttons.push([btn('← Назад', 'book:back:date')]);
  setUserState(chatId, 'book_slot', { ...draft, date });
  await sendMessage(chatId, `${formatSlotLabel(date)}. Свободное время:`, {
    replyMarkup: inlineKeyboard(buttons),
  });
}

async function askName(chatId: string, draft: Record<string, unknown>, user?: TgUser) {
  const tgName = user?.first_name?.trim();
  const rows = [];
  if (tgName) rows.push([btn(`${tgName} (из Telegram)`, 'book:name:tg')]);
  rows.push([btn('Ввести другое имя', 'book:name:custom')]);
  rows.push([btn('← Назад', 'book:back:slot')]);
  setUserState(chatId, 'book_name', draft);
  await sendMessage(chatId, 'Как к вам обращаться?', { replyMarkup: inlineKeyboard(rows) });
}

async function askContact(chatId: string, draft: Record<string, unknown>) {
  setUserState(chatId, 'book_contact', draft);
  await sendMessage(chatId, 'Телефон или @username для связи. Можно пропустить — напишем сюда.', {
    replyMarkup: inlineKeyboard([
      [btn('Написать телефон', 'book:contact:phone')],
      [btn('Написать @username', 'book:contact:user')],
      [btn('Пропустить — писать в Telegram', 'book:contact:skip')],
      [btn('← Назад', 'book:back:name')],
    ]),
  });
}

async function askConfirm(chatId: string, draft: Record<string, unknown>) {
  const model = draft.modelId ? getRawModel(Number(draft.modelId)) : null;
  const label = model ? `${model.brand} ${model.model}` : String(draft.modelLabel || 'Модель');
  const price = model?.priceBase ?? draft.price;
  const contact =
    (draft.phone as string) ||
    (draft.telegram as string) ||
    'Telegram';
  const text = [
    'Проверьте заявку:',
    '',
    label,
    formatSlotLabel(String(draft.date || ''), String(draft.slot || '')),
    `${draft.name}, ${contact}`,
    price != null ? `Цена: ${price} BYN` : null,
    '',
    'Всё верно?',
  ]
    .filter(Boolean)
    .join('\n');

  setUserState(chatId, 'book_confirm', { ...draft, modelLabel: label, price });
  await sendMessage(chatId, text, {
    replyMarkup: inlineKeyboard([
      [btn('Подтвердить', 'book:confirm:yes')],
      [btn('Изменить', 'book:confirm:edit')],
      [btn('← Отменить', 'menu:home')],
    ]),
  });
}

async function createBotOrder(chatId: string, draft: Record<string, unknown>, user?: TgUser) {
  const model = draft.modelId ? getRawModel(Number(draft.modelId)) : null;
  const name = String(draft.name || user?.first_name || 'Клиент').trim();
  const phone = String(draft.phone || '').trim() || 'через Telegram';
  const telegram =
    (draft.telegram as string) ||
    (user?.username ? `@${user.username}` : `@chat:${chatId}`);
  const modelLabel = model
    ? `${model.brand} ${model.model}`
    : String(draft.modelLabel || 'Другая модель');
  const price = model?.priceBase ?? Number(draft.price || 0);
  const cost = model?.costBase ?? 80;

  const result = db
    .insert(orders)
    .values({
      clientName: name,
      clientPhone: phone,
      clientTelegram: telegram,
      clientTelegramChatId: chatId,
      modelId: model?.id ?? null,
      modelLabel,
      price,
      cost,
      status: 'new',
      source: 'telegram',
      scheduledDate: String(draft.date || '') || null,
      scheduledSlot: String(draft.slot || '') || null,
      comment: draft.otherNote ? String(draft.otherNote) : null,
      options: '[]',
      paymentStatus: 'unpaid',
    })
    .run();

  const orderId = Number(result.lastInsertRowid);

  await notifyOwnerBooking({
    orderId,
    name,
    phone,
    telegram: telegram || undefined,
    modelLabel,
    date: draft.date ? String(draft.date) : undefined,
    slot: draft.slot ? String(draft.slot) : undefined,
    price,
    source: 'telegram',
    comment: draft.otherNote ? String(draft.otherNote) : undefined,
  });

  setUserState(chatId, 'idle', {});
  await sendMessage(
    chatId,
    [
      '✅ Заявка принята.',
      '',
      'Подтвердим в течение 15 минут — уведомление придёт сюда.',
      `Если срочно — позвоните ${sitePhone()}.`,
      '',
      `Пока ждёте — ${siteAddress()}.`,
    ].join('\n'),
    {
      replyMarkup: inlineKeyboard([[btn('Мои заказы', 'menu:orders')], [btn('На главную', 'menu:home')]]),
    },
  );
}

async function showOrders(chatId: string, user?: TgUser) {
  const tgUser = getTelegramUser(chatId);
  const rows = findOrdersForClient({
    chatId,
    username: user?.username || tgUser?.username,
    phone: tgUser?.phone,
  });
  if (!rows.length) {
    await sendMessage(chatId, 'Пока нет заказов. Можно записаться за минуту.', {
      replyMarkup: inlineKeyboard([[btn('Записаться', 'menu:book')], backHomeRow()]),
    });
    return;
  }

  for (const row of rows.slice(0, 3)) {
    const text = statusMessageForClient(row);
    const keyboard =
      row.status === 'confirmed'
        ? inlineKeyboard([
            [urlBtn('Показать на карте', `https://maps.google.com/?q=${encodeURIComponent(siteAddress())}`)],
            [btn('Перенести', `cli:resched:${row.id}`), btn('Отменить', `cli:cancel:${row.id}`)],
          ])
        : row.status === 'done'
          ? inlineKeyboard([
              [btn('Страховка обновлений', 'menu:ota')],
              [btn('На главную', 'menu:home')],
            ])
          : inlineKeyboard([backHomeRow()]);
    await sendMessage(chatId, text, { replyMarkup: keyboard });
  }
}

async function showOta(chatId: string) {
  await sendMessage(
    chatId,
    [
      `Страховка после обновления ПО — ${PRICING_OPTIONS.otaInsurance} BYN/год.`,
      '',
      'Если после обновления авто слетит русский язык — восстановим бесплатно, приоритетно.',
      'Первые 3 месяца бесплатно с любой русификацией.',
    ].join('\n'),
    {
      replyMarkup: inlineKeyboard([
        [btn('Подключить', 'ota:yes')],
        [urlBtn('Подробнее на сайте', `${siteUrl()}/#ota`)],
        backHomeRow(),
      ]),
    },
  );
}

async function showPriceIntro(chatId: string) {
  const brands = getBrands().slice(0, 8);
  const buttons = chunkButtons(
    brands.map((b) => btn(b, `price:brand:${encodeURIComponent(b)}`)),
    2,
  );
  buttons.push(backHomeRow());
  await sendMessage(chatId, 'Выберите марку — покажу фикс-цены.', {
    replyMarkup: inlineKeyboard(buttons),
  });
}

async function handleOwnerCommand(chatId: string, text: string) {
  const cmd = text.trim().split(/\s+/)[0]?.toLowerCase();
  if (cmd === '/today') {
    const today = todayIso();
    const rows = db
      .select()
      .from(orders)
      .where(eq(orders.scheduledDate, today))
      .all()
      .filter((r) => r.status !== 'cancelled');
    if (!rows.length) {
      await sendMessage(chatId, `На сегодня (${today}) заявок нет.`);
      return;
    }
    const lines = rows.map(
      (r) => `#${r.id} ${r.scheduledSlot || '—'} · ${r.modelLabel} · ${r.clientName} · ${r.status}`,
    );
    await sendMessage(chatId, `Сегодня:\n\n${lines.join('\n')}`);
    return;
  }
  if (cmd === '/orders') {
    const rows = db.select().from(orders).all().slice(-10).reverse();
    const lines = rows.map(
      (r) => `#${r.id} ${r.status} · ${r.modelLabel} · ${r.clientName} · ${r.clientPhone}`,
    );
    await sendMessage(chatId, `Последние заказы:\n\n${lines.join('\n')}`);
    return;
  }
  if (cmd === '/week' || cmd === '/finance') {
    await sendMessage(chatId, 'Сводка пока в админке: ' + `${siteUrl()}/admin`);
    return;
  }
}

async function forwardToOwner(clientChatId: string, from: TgUser | undefined, text: string) {
  const owner = ownerChatId();
  if (!owner) {
    await sendMessage(clientChatId, 'Сейчас не могу передать сообщение. Позвоните ' + sitePhone());
    return;
  }
  const who = [from?.first_name, from?.username ? `@${from.username}` : null].filter(Boolean).join(' ');
  const res = await sendMessage(
    owner,
    `💬 Сообщение от клиента${who ? ` (${who})` : ''}\nchat:${clientChatId}\n\n${text}\n\n↩ Ответьте reply на это сообщение.`,
  );
  const mid = Number(res.result?.message_id);
  if (mid) saveBridge(mid, clientChatId);
  await sendMessage(clientChatId, 'Передал человеку. Обычно отвечаем в течение дня.', {
    replyMarkup: inlineKeyboard([[btn('Записаться', 'menu:book')], backHomeRow()]),
  });
}

async function handleCallback(cb: TgCallback) {
  const chatId = String(cb.message?.chat.id || cb.from.id);
  const data = cb.data || '';
  const messageId = cb.message?.message_id;
  await answerCallbackQuery(cb.id);

  const user = cb.from;
  upsertTelegramUser({
    chatId,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
  });

  if (data === 'menu:home') {
    await sendHome(chatId, user.first_name);
    return;
  }
  if (data === 'menu:book') {
    await startBooking(chatId);
    return;
  }
  if (data === 'menu:price') {
    await showPriceIntro(chatId);
    return;
  }
  if (data === 'menu:ota') {
    await showOta(chatId);
    return;
  }
  if (data === 'menu:orders') {
    await showOrders(chatId, user);
    return;
  }
  if (data === 'menu:human') {
    setUserState(chatId, 'await_human');
    await sendMessage(chatId, 'Напишите вопрос одним сообщением — передам человеку.', {
      replyMarkup: inlineKeyboard([backHomeRow()]),
    });
    return;
  }
  if (data === 'ota:yes') {
    setUserState(chatId, 'await_human');
    await sendMessage(
      chatId,
      'Ок. Напишите имя и телефон — оформим страховку обновлений. Или запишитесь, и подключим вместе с работой.',
      { replyMarkup: inlineKeyboard([[btn('Записаться', 'menu:book')], backHomeRow()]) },
    );
    return;
  }

  // Admin actions
  if (data.startsWith('adm:')) {
    if (!isOwnerChat(chatId)) {
      await sendMessage(chatId, 'Эта кнопка только для владельца.');
      return;
    }
    const [, action, idRaw] = data.split(':');
    const orderId = Number(idRaw);
    const row = db.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!row) {
      await sendMessage(chatId, `Заказ #${orderId} не найден.`);
      return;
    }

    if (action === 'ok') {
      db.update(orders).set({ status: 'confirmed' }).where(eq(orders.id, orderId)).run();
      const updated = db.select().from(orders).where(eq(orders.id, orderId)).get()!;
      if (messageId) {
        await editMessageText(
          chatId,
          messageId,
          `✅ Заказ #${orderId} подтверждён\n${row.modelLabel}\n${formatSlotLabel(row.scheduledDate || undefined, row.scheduledSlot || undefined)}\n${row.clientName}, ${row.clientPhone}`,
        );
      }
      await sendMessage(chatId, 'Клиенту уходит подтверждение.');
      await notifyClientStatus({
        chatId: row.clientTelegramChatId,
        telegram: row.clientTelegram,
        phone: row.clientPhone,
        message: statusMessageForClient(updated),
        replyMarkup: inlineKeyboard([
          [urlBtn('Показать на карте', `https://maps.google.com/?q=${encodeURIComponent(siteAddress())}`)],
        ]),
      });
      return;
    }

    if (action === 'no') {
      db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, orderId)).run();
      const updated = db.select().from(orders).where(eq(orders.id, orderId)).get()!;
      if (messageId) {
        await editMessageText(chatId, messageId, `❌ Заказ #${orderId} отменён`);
      }
      await notifyClientStatus({
        chatId: row.clientTelegramChatId,
        telegram: row.clientTelegram,
        phone: row.clientPhone,
        message: statusMessageForClient(updated),
      });
      return;
    }

    if (action === 'msg') {
      const clientChat = row.clientTelegramChatId;
      if (!clientChat) {
        await sendMessage(chatId, `У заказа #${orderId} нет chat_id. Связь: ${row.clientPhone} ${row.clientTelegram || ''}`);
        return;
      }
      setUserState(chatId, `owner_msg:${clientChat}`);
      await sendMessage(chatId, `Напишите сообщение клиенту заказа #${orderId}:`);
      return;
    }
    return;
  }

  // Client cancel / reschedule
  if (data.startsWith('cli:')) {
    const [, action, idRaw] = data.split(':');
    const orderId = Number(idRaw);
    const row = db.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!row || row.clientTelegramChatId !== chatId) {
      await sendMessage(chatId, 'Заказ не найден.');
      return;
    }
    if (action === 'cancel') {
      if (row.scheduledDate && row.scheduledSlot) {
        const when = new Date(`${row.scheduledDate}T${row.scheduledSlot}:00`);
        const hoursLeft = (when.getTime() - Date.now()) / 36e5;
        if (hoursLeft < 2) {
          await sendMessage(chatId, `До слота меньше 2 часов — позвоните ${sitePhone()}, обсудим индивидуально.`);
          return;
        }
      }
      db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, orderId)).run();
      const owner = ownerChatId();
      if (owner) await sendMessage(owner, `Клиент отменил заказ #${orderId}`);
      await sendMessage(chatId, 'Заявка отменена. Можно записаться на другое время.', {
        replyMarkup: inlineKeyboard([[btn('Записаться', 'menu:book')], backHomeRow()]),
      });
      return;
    }
    if (action === 'resched') {
      await startBooking(chatId);
      return;
    }
  }

  // Price browse
  if (data.startsWith('price:brand:')) {
    const brand = decodeURIComponent(data.slice('price:brand:'.length));
    const models = getAllModels().filter((m) => m.brand === brand).slice(0, 10);
    const lines = models.map((m) => `${m.model} — ${m.priceBase} BYN · ~${m.timeMinutes} мин`);
    await sendMessage(chatId, lines.length ? `${brand}:\n\n${lines.join('\n')}` : 'Моделей пока нет.', {
      replyMarkup: inlineKeyboard([[btn('Записаться', 'menu:book')], backHomeRow()]),
    });
    return;
  }

  // Booking FSM callbacks
  if (data.startsWith('book:')) {
    const tgUser = getTelegramUser(chatId);
    const draft = parseDraft(tgUser?.draft);

    if (data === 'book:back:brand') {
      await startBooking(chatId);
      return;
    }
    if (data === 'book:back:model') {
      if (draft.brand) await askModels(chatId, String(draft.brand));
      else await startBooking(chatId);
      return;
    }
    if (data === 'book:back:date') {
      await askDates(chatId, draft);
      return;
    }
    if (data === 'book:back:slot') {
      if (draft.date) await askSlots(chatId, draft, String(draft.date));
      else await askDates(chatId, draft);
      return;
    }
    if (data === 'book:back:name') {
      await askName(chatId, draft, user);
      return;
    }

    if (data.startsWith('book:brand:')) {
      const brand = decodeURIComponent(data.slice('book:brand:'.length));
      if (brand === '__other__') {
        setUserState(chatId, 'book_other_brand', {});
        await sendMessage(chatId, 'Напишите марку и модель текстом.', {
          replyMarkup: inlineKeyboard([backHomeRow()]),
        });
        return;
      }
      await askModels(chatId, brand);
      return;
    }

    if (data.startsWith('book:model:')) {
      const idRaw = data.slice('book:model:'.length);
      if (idRaw === 'other') {
        setUserState(chatId, 'book_other_model', { ...draft });
        await sendMessage(chatId, 'Напишите модель текстом.', {
          replyMarkup: inlineKeyboard([[btn('← Назад', 'book:back:brand')]]),
        });
        return;
      }
      const model = getRawModel(Number(idRaw));
      if (!model) {
        await sendMessage(chatId, 'Модель не найдена. Выберите снова.');
        await startBooking(chatId);
        return;
      }
      await askDates(chatId, {
        brand: model.brand,
        modelId: model.id,
        modelLabel: `${model.brand} ${model.model}`,
        price: model.priceBase,
      });
      return;
    }

    if (data.startsWith('book:date:')) {
      const date = data.slice('book:date:'.length);
      await askSlots(chatId, draft, date);
      return;
    }

    if (data.startsWith('book:slot:')) {
      const slot = data.slice('book:slot:'.length);
      const date = String(draft.date || '');
      if (date && occupiedSlots(date).has(slot)) {
        await sendMessage(chatId, 'Слот только что заняли. Выберите другое время.');
        await askSlots(chatId, draft, date);
        return;
      }
      await askName(chatId, { ...draft, slot }, user);
      return;
    }

    if (data === 'book:name:tg') {
      const name = user.first_name || 'Клиент';
      await askContact(chatId, { ...draft, name });
      return;
    }
    if (data === 'book:name:custom') {
      setUserState(chatId, 'book_name_text', draft);
      await sendMessage(chatId, 'Напишите, как к вам обращаться — например, Сергей.');
      return;
    }

    if (data === 'book:contact:phone') {
      setUserState(chatId, 'book_phone_text', draft);
      await sendMessage(chatId, 'Телефон в формате +375 XX XXX-XX-XX');
      return;
    }
    if (data === 'book:contact:user') {
      setUserState(chatId, 'book_user_text', draft);
      await sendMessage(chatId, 'Напишите @username');
      return;
    }
    if (data === 'book:contact:skip') {
      const username = user.username ? `@${user.username}` : null;
      await askConfirm(chatId, { ...draft, telegram: username });
      return;
    }

    if (data === 'book:confirm:yes') {
      await createBotOrder(chatId, draft, user);
      return;
    }
    if (data === 'book:confirm:edit') {
      await startBooking(chatId);
      return;
    }
  }
}

async function handleMessage(msg: TgMessage) {
  const chatId = String(msg.chat.id);
  const user = msg.from;
  const text = (msg.text || '').trim();

  upsertTelegramUser({
    chatId,
    username: user?.username,
    firstName: user?.first_name,
    lastName: user?.last_name,
  });

  // Owner reply bridge
  if (isOwnerChat(chatId) && msg.reply_to_message) {
    const bridge = findBridge(msg.reply_to_message.message_id);
    if (bridge && text) {
      await sendMessage(bridge.clientChatId, text);
      await sendMessage(chatId, 'Ответ отправлен клиенту.');
      return;
    }
  }

  // Owner composing direct message to client
  if (isOwnerChat(chatId)) {
    const ownerState = getTelegramUser(chatId);
    if (ownerState?.state?.startsWith('owner_msg:') && text) {
      const clientChat = ownerState.state.slice('owner_msg:'.length);
      await sendMessage(clientChat, text);
      setUserState(chatId, 'idle', {});
      await sendMessage(chatId, 'Отправлено.');
      return;
    }
    if (text.startsWith('/')) {
      await handleOwnerCommand(chatId, text);
      return;
    }
  }

  if (text === '/start' || text === '/menu') {
    await sendHome(chatId, user?.first_name);
    return;
  }

  if (msg.photo?.length) {
    await forwardToOwner(chatId, user, '📎 клиент отправил скриншот/фото');
    return;
  }

  if (msg.contact?.phone_number) {
    const phone = msg.contact.phone_number;
    upsertTelegramUser({ chatId, phone });
    const tgUser = getTelegramUser(chatId);
    const draft = parseDraft(tgUser?.draft);
    if (tgUser?.state === 'book_contact' || tgUser?.state === 'book_phone_text') {
      await askConfirm(chatId, { ...draft, phone });
      return;
    }
    await sendMessage(chatId, `Номер сохранён: ${phone}`, {
      replyMarkup: mainMenuKeyboard(),
    });
    return;
  }

  const tgUser = getTelegramUser(chatId);
  const state = tgUser?.state || 'idle';
  const draft = parseDraft(tgUser?.draft);

  if (state === 'await_human' && text) {
    await forwardToOwner(chatId, user, text);
    setUserState(chatId, 'idle', {});
    return;
  }

  if (state === 'book_other_brand' && text) {
    await askDates(chatId, { modelLabel: text, otherNote: text });
    return;
  }
  if (state === 'book_other_model' && text) {
    await askDates(chatId, {
      ...draft,
      modelLabel: `${draft.brand || ''} ${text}`.trim(),
      otherNote: text,
    });
    return;
  }
  if (state === 'book_name_text' && text) {
    if (!isLikelyName(text)) {
      await sendMessage(chatId, 'Кажется, это не имя. Напишите, как к вам обращаться — например, Сергей.');
      return;
    }
    await askContact(chatId, { ...draft, name: text });
    return;
  }
  if (state === 'book_phone_text' && text) {
    if (!isValidPhone(text)) {
      await sendMessage(chatId, 'Телефон должен быть в формате +375 XX XXX-XX-XX. Проверьте и отправьте ещё раз.');
      return;
    }
    upsertTelegramUser({ chatId, phone: text });
    await askConfirm(chatId, { ...draft, phone: text });
    return;
  }
  if (state === 'book_user_text' && text) {
    const username = normalizeUsername(text);
    if (!username) {
      await sendMessage(chatId, 'Нужен @username без пробелов. Или нажмите «Пропустить».');
      return;
    }
    await askConfirm(chatId, { ...draft, telegram: `@${username}` });
    return;
  }

  if (!text) {
    await sendMessage(chatId, 'Напишите текстом или выберите пункт меню.', {
      replyMarkup: mainMenuKeyboard(),
    });
    return;
  }

  if (/^(привет|здравствуйте|добрый|есть кто)/i.test(text)) {
    await sendMessage(chatId, 'Здравствуйте. Что нужно — записаться, узнать цену, или вопрос?', {
      replyMarkup: inlineKeyboard([
        [btn('Записаться', 'menu:book')],
        [btn('Узнать цену', 'menu:price')],
        [btn('Вопрос', 'menu:human')],
        [btn('Мои заказы', 'menu:orders')],
      ]),
    });
    return;
  }

  const faq = matchFaq(text);
  if (faq) {
    await sendMessage(chatId, faq, {
      replyMarkup: inlineKeyboard([
        [btn('Записаться', 'menu:book')],
        [btn('Написать человеку', 'menu:human')],
        backHomeRow(),
      ]),
    });
    return;
  }

  // Unknown → soft handoff
  await sendMessage(
    chatId,
    `Хороший вопрос — отвечу человеком, чтобы не напутать. Напишите ещё раз сюда, или позвоните ${sitePhone()}.`,
    {
      replyMarkup: inlineKeyboard([[btn('Написать человеку', 'menu:human')], backHomeRow()]),
    },
  );
}

export async function handleTelegramUpdate(update: TgUpdate) {
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }
  if (update.message) {
    await handleMessage(update.message);
  }
}
