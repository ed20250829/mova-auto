// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { SEED_MODELS } from './src/db/seed-data.ts';

const site = 'https://mova-auto.tech';
const brandSlugs = [...new Set(SEED_MODELS.map((m) => m.brandSlug))];
const modelPages = SEED_MODELS.map(
  (m) => `${site}/auto/${m.brandSlug}/${m.modelSlug}`,
);
const brandPages = brandSlugs.map((slug) => `${site}/auto/${slug}`);
const seoPages = [
  `${site}/sravnenie`,
  `${site}/cena`,
  `${site}/kak-prohodit`,
  `${site}/kodirovanie-vs-rusifikaciya`,
];

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
      customPages: [...seoPages, ...brandPages, ...modelPages],
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
