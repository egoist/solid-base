import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateHydrationScript, renderToString } from '@solidjs/web';
import { fixtures } from './fixtures';

it('renders every fixture on the server', () => {
  const output: Record<string, string> = {};
  for (const { name, App } of fixtures) {
    output[name] = renderToString(() => <App />);
  }
  const dir = resolve(import.meta.dirname, '.out');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, 'ssr.json'),
    JSON.stringify({ script: generateHydrationScript(), html: output }),
  );
  expect(Object.keys(output).length).toBe(fixtures.length);
});
