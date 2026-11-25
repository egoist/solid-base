import { defineConfig, type Plugin } from 'vitest/config';
import solid from '@solidjs/vite-plugin';

/**
 * Solid's server build reports `SERVER_WRITE` once per process. Report every write instead, so
 * each test fails on its own writers rather than only the first test that writes.
 */
function reportEveryServerWrite(): Plugin {
  return {
    name: 'report-every-server-write',
    transform(code, id) {
      if (!/[\\/]solid-js[\\/]dist[\\/]server\.dev\.js$/.test(id)) {
        return;
      }
      const dedupe = 'if (warnedServerWrites.has(category)) return;';
      if (!code.includes(dedupe)) {
        throw new Error('report-every-server-write: solid-js no longer dedupes SERVER_WRITE here');
      }
      return code.replace(dedupe, '');
    },
  };
}

export default defineConfig({
  plugins: [solid({ ssr: true }), reportEveryServerWrite()],
  resolve: {
    conditions: ['source', 'node', 'development'],
  },
  ssr: {
    resolve: {
      conditions: ['source', 'node', 'development'],
    },
    // Solid itself is inlined so `reportEveryServerWrite` can transform it.
    noExternal: [/^@egoist\//, 'solid-js', '@solidjs/web'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/ssr/**/*.test.tsx'],
    setupFiles: ['./test/ssr/setup.ts'],
  },
});
