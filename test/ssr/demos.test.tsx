import { renderToString } from '@solidjs/web';
import type { Component } from 'solid-js';

// Server-renders every playground demo, which together use every component.
const demos = import.meta.glob<{ default: Component }>('../../playground/src/demos/*.tsx', {
  eager: true,
});

describe('server rendering', () => {
  it.each(Object.entries(demos).map(([path, mod]) => [path.split('/').pop()!, mod.default]))(
    '%s renders to a string',
    (_name, Demo) => {
      const html = renderToString(() => <Demo />);
      expect(html.length).toBeGreaterThan(0);
    },
  );
});
