// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { SEED_MODELS } from './src/db/seed-data.ts';

const site = 'https://mova-auto.tech';
const modelPages = SEED_MODELS.map(
  (m) => `${site}/auto/${m.brandSlug}/${m.modelSlug}`,
);

export default defineConfig({
  site,
  output: 'server',
  // Cookie auth only — no Astro.session; avoid absolute host paths in the build.
  session: false,
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        try {
          const pathname = new URL(page).pathname;
          return !pathname.startsWith('/admin');
        } catch {
          return !page.includes('/admin');
        }
      },
      customPages: modelPages,
    }),
  ],
  adapter: node({
    mode: 'middleware',
  }),
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['better-sqlite3'],
    },
    ssr: {
      external: ['better-sqlite3'],
    },
  },
});
