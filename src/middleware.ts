import { defineMiddleware } from 'astro:middleware';
import { isAuthenticated } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!isAuthenticated(context.cookies)) {
      if (pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return context.redirect(`/admin/login?next=${encodeURIComponent(pathname)}`);
    }
  }

  if (pathname.startsWith('/api/admin') && !pathname.includes('/login')) {
    if (!isAuthenticated(context.cookies)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return next();
});
