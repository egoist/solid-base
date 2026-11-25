import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';

// Pass 2: hydrate the server HTML in jsdom.
export default defineConfig({
  plugins: [solid({ ssr: true, solid: { hydratable: true } })],
  resolve: { conditions: ['source', 'browser', 'development'] },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['test/hydration/hydrate.client.test.tsx'],
  },
});
