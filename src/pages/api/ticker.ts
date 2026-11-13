import type { APIRoute } from 'astro';
import { getTickerPayload } from '../../lib/ticker';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const payload = getTickerPayload();
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Edge/browser: short; server already caches 5 min in lib
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    });
  } catch {
    return new Response(JSON.stringify({ manifesto: [], social: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }
};
