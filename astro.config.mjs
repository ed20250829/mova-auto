// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://mova-auto.tech',
  output: 'server',
  // Cookie auth only — no Astro.session; avoid absolute host paths in the build.
  session: false,
  integrations: [react(), sitemap()],
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
