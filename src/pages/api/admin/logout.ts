import type { APIRoute } from 'astro';
import { clearAdminCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  clearAdminCookie(cookies);
  return redirect('/admin/login');
};
