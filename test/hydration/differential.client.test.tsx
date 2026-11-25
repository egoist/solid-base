import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flush } from 'solid-js';
import { hydrate, render } from '@solidjs/web';
import { fireEvent } from '@solidjs/testing-library';
import { fixtures } from './fixtures';

const { script, html } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '.out/ssr.json'), 'utf8'),
) as { script: string; html: Record<string, string> };
const bootstrap = /<script[^>]*>([\s\S]*?)<\/script>/.exec(script)?.[1] ?? '';

// jsdom has no Web Animations API; demos animating with `element.animate` get a finished one.
Element.prototype.animate ??= function animate() {
  return { finished: Promise.resolve(), cancel() {}, finish() {} } as unknown as Animation;
};

const INTERACTIVE = 'button, [role=switch], [role=checkbox], [role=tab], [role=radio]';
const tick = () => new Promise((r) => setTimeout(r, 20));

const ID_ATTRIBUTES = new Set([
  'id',
  'for',
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-activedescendant',
  'aria-owns',
]);
const IGNORED_ATTRIBUTES = new Set(['_hk', 'tabindex']);

/**
 * Markup in a canonical form: sorted attributes (hydration keeps the server's order), generated
 * ids and hydration keys removed, comments dropped.
 */
function normalize(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  const element = node as Element;
  const attributes = [...element.attributes]
    .filter((attribute) => !IGNORED_ATTRIBUTES.has(attribute.name) && !attribute.name.startsWith('data-base-ui-'))
    .map((attribute) => `${attribute.name}="${ID_ATTRIBUTES.has(attribute.name) ? 'ID' : attribute.value}"`)
    .sort()
    .join(' ');
  const children = [...element.childNodes].map(normalize).join('');
  return `<${element.localName}${attributes ? ` ${attributes}` : ''}>${children}</${element.localName}>`;
}

async function press(element: HTMLElement) {
  fireEvent.pointerDown(element, { pointerType: 'mouse' });
  fireEvent.mouseDown(element);
  fireEvent.pointerUp(element, { pointerType: 'mouse' });
  fireEvent.mouseUp(element);
  fireEvent.click(element);
  flush();
  await tick();
  flush();
}

/**
 * A hydrated demo must behave like a client-rendered one: press the same controls in both and
 * compare the resulting markup.
 */
describe('hydrated demos behave like client-rendered ones', () => {
  it.each(fixtures.map((fixture) => [fixture.name, fixture] as const))('%s', async (name, fixture) => {
    const portalsBefore = document.body.children.length;
    new Function(bootstrap)();
    const hydrated = document.createElement('div');
    hydrated.innerHTML = html[name]!;
    document.body.append(hydrated);
    const disposeHydrated = hydrate(() => <fixture.App />, hydrated);

    const rendered = document.createElement('div');
    document.body.append(rendered);
    const disposeRendered = render(() => <fixture.App />, rendered);
    flush();
    await tick();

    const targets = (container: HTMLElement) =>
      [...container.querySelectorAll<HTMLElement>(INTERACTIVE)].slice(0, 3);
    const hydratedTargets = targets(hydrated);
    const renderedTargets = targets(rendered);
    expect(hydratedTargets.length).toBe(renderedTargets.length);

    // Focus is global: snapshot each copy right after its own press, before the other one
    // takes focus away.
    const pressAndSnapshot = async (element: HTMLElement, container: HTMLElement) => {
      await press(element);
      // Close anything the press opened, so later presses start from the same state.
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      flush();
      await tick();
      return normalize(container);
    };

    for (let i = 0; i < hydratedTargets.length; i += 1) {
      const afterHydrated = await pressAndSnapshot(hydratedTargets[i]!, hydrated);
      const afterRendered = await pressAndSnapshot(renderedTargets[i]!, rendered);
      expect(afterHydrated, `after pressing control ${i + 1}`).toBe(afterRendered);
    }

    disposeHydrated();
    disposeRendered();
    hydrated.remove();
    rendered.remove();
    while (document.body.children.length > portalsBefore) {
      document.body.lastElementChild!.remove();
    }
  });
});
