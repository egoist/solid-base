import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { fixtures } from './fixtures';

const { script, html } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '.out/ssr.json'), 'utf8'),
) as { script: string; html: Record<string, string> };

// Install the hydration bootstrap (`window._$HY`) the server script defines.
const bootstrap = /<script[^>]*>([\s\S]*?)<\/script>/.exec(script)?.[1] ?? '';

describe('hydration', () => {
  it.each(fixtures.map((fixture) => [fixture.name, fixture] as const))(
    '%s hydrates without mismatches',
    async (name, fixture) => {
      const warnings: string[] = [];
      const warn = vi.spyOn(console, 'warn').mockImplementation((...args) => {
        warnings.push(args.map(String).join(' '));
      });
      const error = vi.spyOn(console, 'error').mockImplementation((...args) => {
        warnings.push(args.map(String).join(' '));
      });
      // eslint-disable-next-line no-new-func
      new Function(bootstrap)();
      const container = document.createElement('div');
      container.innerHTML = html[name]!;
      document.body.append(container);
      const serverMarkup = container.innerHTML;

      const dispose = hydrate(() => <fixture.App />, container);
      flush();
      await Promise.resolve();
      flush();

      warn.mockRestore();
      error.mockRestore();
      dispose();
      container.remove();

      expect(warnings.filter((w) => /hydrat|mismatch|\[[A-Z_]{5,}\]/i.test(w))).toEqual([]);
      expect(serverMarkup.length).toBeGreaterThan(0);
    },
  );
});
