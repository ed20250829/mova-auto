import type { APIRoute } from 'astro';
import { ensureDb } from '../../../lib/models';
import { handleTelegramUpdate } from '../../../lib/telegram-bot';
import { telegramToken } from '../../../lib/telegram';

export const prerender = false;

function env(name: string): string | undefined {
  return (import.meta.env[name] as string | undefined) || process.env[name];
}

export const POST: APIRoute = async ({ request }) => {
  ensureDb();

  if (!telegramToken()) {
    return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN missing' }, 503);
  }

  const secret = env('TELEGRAM_WEBHOOK_SECRET');
  if (secret) {
    const header = request.headers.get('x-telegram-bot-api-secret-token');
    if (header !== secret) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400);
  }

  try {
    await handleTelegramUpdate(update as Parameters<typeof handleTelegramUpdate>[0]);
  } catch (err) {
    console.error('[telegram webhook]', err);
  }

  // Always 200 so Telegram does not retry aggressively on handler bugs.
  return json({ ok: true });
};

export const GET: APIRoute = async () => {
  return json({
    ok: true,
    service: 'mova-telegram-webhook',
    hint: 'POST Telegram updates here. Set webhook with setWebhook.',
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
