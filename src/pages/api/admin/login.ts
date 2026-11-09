import type { APIRoute } from 'astro';
import { getAdminToken, setAdminCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const contentType = request.headers.get('content-type') || '';
  let token = '';
  let next = '/admin';

  if (contentType.includes('application/json')) {
    const body = await request.json();
    token = String(body.token || '');
    next = String(body.next || '/admin');
  } else {
    const form = await request.formData();
    token = String(form.get('token') || '');
    next = String(form.get('next') || '/admin');
  }

  if (token !== getAdminToken()) {
    return redirect('/admin/login?error=1');
  }

  setAdminCookie(cookies, token);
  if (!next.startsWith('/admin')) next = '/admin';
  return redirect(next);
};
