import { createEffect, createMemo, createRoot, flush } from 'solid-js';
import { ReactiveStore } from './reactiveStore';

describe('ReactiveStore', () => {
  it('returns the latest value right after a write and tracks reads in reactive scopes', () => {
    const store = new ReactiveStore({ count: 0 }, {}, { double: (s: { count: number }) => s.count * 2 });
    const seen: number[] = [];
    const dispose = createRoot((d) => {
      const double = createMemo(() => store.select('double'));
      createEffect(double, (value) => {
        seen.push(value);
      });
      return d;
    });
    flush();
    store.set('count', 2);
    expect(store.state.count).toBe(2);
    expect(store.select('count')).toBe(2);
    flush();
    expect(seen).toEqual([0, 4]);
    dispose();
  });

  it('can be read inside effect apply phases without diagnostics', () => {
    const store = new ReactiveStore({ open: false }, {});
    const values: boolean[] = [];
    const dispose = createRoot((d) => {
      createEffect(
        () => 1,
        () => {
          values.push(store.select('open'));
        },
      );
      return d;
    });
    flush();
    expect(values).toEqual([false]);
    dispose();
  });

  it('binds keys to accessors', () => {
    let external = true;
    const store = new ReactiveStore({ value: false }, {});
    store.bind('value', () => external);
    expect(store.select('value')).toBe(true);
    store.set('value', false);
    expect(store.state.value).toBe(true);
    external = false;
    expect(store.state.value).toBe(false);
  });
});
