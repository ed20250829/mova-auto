import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { resolveCaseImageFile } from '../../../lib/cases';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export const GET: APIRoute = async ({ params }) => {
  const name = params.name || '';
  const file = resolveCaseImageFile(name);
  if (!file) {
    return new Response('Not found', { status: 404 });
  }
  const ext = extname(file).toLowerCase();
  const body = readFileSync(file);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
