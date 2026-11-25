import { defineConfig } from 'vite';
import solid from '@solidjs/vite-plugin';

export default defineConfig({
  plugins: [solid()],
  resolve: {
    conditions: ['source', 'browser', 'module', 'import', 'development|production'],
  },
});
