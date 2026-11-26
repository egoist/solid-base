import { defineConfig } from 'cf/config';

// The site is fully prerendered: it deploys as an assets-only Worker (`bun run deploy`).
export default defineConfig({
  worker: {
    name: 'solid-base',
    compatibilityDate: '2026-11-26',
    domains: ['base.egoist.dev'],
    assets: {
      // Pages are `<route>/index.html`; serve them at `/<route>`, which is what links use.
      htmlHandling: 'drop-trailing-slash',
      // Unknown URLs get the prerendered `404.html` (with a 404 status).
      notFoundHandling: '404-page',
    },
  },
});
