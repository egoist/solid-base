import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';

export default defineConfig({
  plugins: [solid({ ssr: true })],
  resolve: {
    conditions: ['source', 'node', 'development'],
  },
  ssr: {
    resolve: {
      conditions: ['source', 'node', 'development'],
    },
    noExternal: [/^@egoist\//],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/ssr/**/*.test.tsx'],
  },
});
