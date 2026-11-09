import type { APIContext, AstroCookies } from 'astro';

export const ADMIN_COOKIE = 'mova_admin';

const DEV_FALLBACK = 'dev-admin-token-change-me';

export function getAdminToken(): string {
  const token = import.meta.env.ADMIN_TOKEN || process.env.ADMIN_TOKEN;
  if (!token) {
    if (import.meta.env.PROD || process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_TOKEN must be set in production (no dev fallback).');
    }
    return DEV_FALLBACK;
  }
  if (
    (import.meta.env.PROD || process.env.NODE_ENV === 'production') &&
    token === DEV_FALLBACK
  ) {
    throw new Error('ADMIN_TOKEN must not use the local dev fallback in production.');
  }
  return token;
}

export function isAuthenticated(cookies: AstroCookies): boolean {
  const value = cookies.get(ADMIN_COOKIE)?.value;
  return Boolean(value && value === getAdminToken());
}

export function requireAdmin(context: APIContext): Response | null {
  if (!isAuthenticated(context.cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

export function setAdminCookie(cookies: AstroCookies, token: string) {
  cookies.set(ADMIN_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    maxAge: 60 * 60 * 24 * 14,
  });
}

export function clearAdminCookie(cookies: AstroCookies) {
  cookies.delete(ADMIN_COOKIE, { path: '/' });
}
