import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';

export default defineConfig({
  plugins: [solid()],
  resolve: {
    conditions: ['source', 'browser', 'development'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['packages/*/src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    // Server rendering runs in its own Node environment: `bun run test:ssr`.
    exclude: ['test/ssr/**', '**/node_modules/**'],
  },
});
