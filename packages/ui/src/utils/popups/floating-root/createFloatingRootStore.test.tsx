import { createSignal, flush } from 'solid-js';
import { render } from '@solidjs/testing-library';
import { createFloatingRootStore } from './createFloatingRootStore';
import type { FloatingRootStore } from './FloatingRootStore';

describe('createFloatingRootStore', () => {
  function Test(props: { anchor: Element | null; onStore: (store: FloatingRootStore) => void }) {
    const store = createFloatingRootStore({ anchor: () => props.anchor });
    props.onStore(store);
    return null;
  }

  it('follows the anchor when it changes after the first render', () => {
    const first = document.createElement('button');
    const second = document.createElement('button');
    const [anchor, setAnchor] = createSignal<Element | null>(first);
    let store: FloatingRootStore | undefined;
    const onStore = (value: FloatingRootStore) => {
      store = value;
    };

    render(() => <Test anchor={anchor()} onStore={onStore} />);
    flush();
    expect(store?.select('anchor')).toBe(first);

    setAnchor(second);
    flush();

    expect(store?.select('anchor')).toBe(second);
    expect(store?.select('anchorElement')).toBe(second);
  });
});
