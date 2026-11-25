import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';

export default defineConfig({
  plugins: [solid()],
  resolve: {
    conditions: ['browser', 'development'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['packages/*/src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
  },
});
