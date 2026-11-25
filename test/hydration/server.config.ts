import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';

// Pass 1: server-render every fixture to `.out/ssr.json`.
export default defineConfig({
  plugins: [solid({ ssr: true, solid: { hydratable: true } })],
  resolve: { conditions: ['source', 'node', 'development'] },
  ssr: { resolve: { conditions: ['source', 'node', 'development'] }, noExternal: [/^@egoist\//] },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/hydration/*.server.test.tsx'],
  },
});
