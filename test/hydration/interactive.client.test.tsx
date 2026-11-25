import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { fireEvent } from '@solidjs/testing-library';
import { fixtures } from './fixtures';

const { script, html } = JSON.parse(readFileSync(resolve(import.meta.dirname, '.out/ssr.json'), 'utf8'));
const bootstrap = /<script[^>]*>([\s\S]*?)<\/script>/.exec(script)?.[1] ?? '';
const tick = () => new Promise((r) => setTimeout(r, 30));

// Hydrated markup must be interactive, not just mismatch-free: open click-triggered popups.
it.each([
  'docs/components/popover/demos/hero',
  'docs/components/menu/demos/hero',
  'docs/components/dialog/demos/hero',
  'docs/components/alert-dialog/demos/hero',
  'docs/components/select/demos/hero',
  'docs/components/drawer/demos/hero',
])('%s opens after hydration', async (name) => {
  const fixture = fixtures.find((f) => f.name === name)!;
  new Function(bootstrap)();
  const container = document.createElement('div');
  container.innerHTML = html[name];
  document.body.append(container);
  hydrate(() => <fixture.App />, container);
  flush();
  await tick();
  const button = container.querySelector<HTMLElement>('button, [role=combobox]')!;
  fireEvent.pointerDown(button, { pointerType: 'mouse' });
  fireEvent.mouseDown(button);
  fireEvent.pointerUp(button, { pointerType: 'mouse' });
  fireEvent.mouseUp(button);
  fireEvent.click(button);
  flush();
  await tick();
  flush();
  expect(button.getAttribute('aria-expanded') ?? button.hasAttribute('data-popup-open')).toBe('true');
});
