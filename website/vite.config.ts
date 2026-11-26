import { resolve } from 'node:path';
import { defaultClientConditions, defaultServerConditions, defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/solid-start/plugin/vite';
import solid from '@solidjs/vite-plugin';
import { docs } from './plugins/docs.ts';

const docsDir = resolve(import.meta.dirname, '../docs');

export default defineConfig({
  plugins: [
    docs({ docsDir, apiFile: resolve(import.meta.dirname, 'src/generated/api.json') }),
    tanstackStart({
      // Every page is static: prerender the site by crawling links from the home page.
      prerender: { enabled: true, crawlLinks: true },
      // The host serves `404.html` for unknown URLs.
      pages: [{ path: '/404', prerender: { outputPath: '/404.html' } }],
    }),
    solid({ ssr: true }),
  ],
  resolve: {
    // Use the library's source in the workspace for instant HMR.
    conditions: ['source', ...defaultClientConditions],
  },
  ssr: {
    resolve: {
      conditions: ['source', ...defaultServerConditions],
    },
    // Compile the workspace packages with the Solid plugin on the server too.
    noExternal: [/^@egoist\//],
  },
  server: {
    fs: { allow: [resolve(import.meta.dirname, '..')] },
  },
  css: {
    modules: {
      generateScopedName: '[name]_[local]_[hash:base64:4]',
    },
  },
});
