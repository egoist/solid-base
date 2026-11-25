import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import solid from '@solidjs/vite-plugin';

const src = resolve(import.meta.dirname, 'src');

// One entry per public module (`src/<module>/index.ts`) plus the barrel.
const entries: Record<string, string> = { index: resolve(src, 'index.ts') };
for (const name of readdirSync(src)) {
  const file = resolve(src, name, 'index.ts');
  if (!['internals', 'utils', 'types'].includes(name) && existsSync(file)) {
    entries[`${name}/index`] = file;
  }
}

export default defineConfig({
  plugins: [solid()],
  build: {
    outDir: 'dist/esm',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    lib: {
      entry: entries,
      formats: ['es'],
    },
    rolldownOptions: {
      external: (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0'),
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
});
