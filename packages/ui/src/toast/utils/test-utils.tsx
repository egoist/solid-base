import { For, createSignal, flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { afterEach, beforeEach, vi } from 'vitest';
import {
  fireEvent as baseFireEvent,
  render as baseRender,
  screen,
} from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Toast } from '..';

export { screen };

/**
 * Lets pending microtasks run and flushes Solid's queued updates.
 */
export async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
  flush();
}

/**
 * Runs `fn`, then flushes Solid's queued updates and pending microtasks (upstream's `act`).
 */
export async function act(fn: () => unknown) {
  await fn();
  flush();
  await flushMicrotasks();
}

/**
 * `fireEvent` that flushes Solid's queued updates after dispatching, like React's `act`.
 */
export const fireEvent = new Proxy(baseFireEvent, {
  get(target, key) {
    const value = (target as any)[key];
    if (typeof value !== 'function') {
      return value;
    }
    if (key === 'mouseEnter' || key === 'mouseLeave') {
      // A pointer entering (or leaving) an element from outside the page enters (or leaves) all of
      // its ancestors too. React synthesizes these events, so upstream fires them on the toast
      // and the viewport handlers run; native ones don't bubble, so dispatch them on each element.
      return (element: Element, init?: MouseEventInit) => {
        let result = true;
        for (let node: Element | null = element; node; node = node.parentElement) {
          result = value(node, init) && result;
        }
        flush();
        return result;
      };
    }
    return (...args: any[]) => {
      const result = value(...args);
      flush();
      return result;
    };
  },
  apply(target, thisArg, args: any[]) {
    const result = Reflect.apply(target as any, thisArg, args);
    flush();
    return result;
  },
}) as typeof baseFireEvent;

/**
 * Renders `ui` and returns a `user-event` instance along with the render result.
 * With fake timers, `user-event` advances them.
 */
export function render(ui: () => JSX.Element) {
  const user = userEvent.setup({
    advanceTimers: (ms) => {
      if (vi.isFakeTimers()) {
        vi.advanceTimersByTime(ms);
      }
    },
  });
  const result = baseRender(ui);
  return { ...result, user };
}

/**
 * Renders `createComponent(props)` and returns a `setProps` that merges new props in, like
 * upstream's `setProps`. Props are exposed through getters, so the component sees the latest values.
 */
export function renderWithProps<P extends object>(
  createComponent: (props: P) => JSX.Element,
  initialProps: P,
) {
  const [state, setState] = createSignal<{ value: P }>({ value: initialProps }, { ownedWrite: true });
  const live = new Proxy({} as P, {
    get: (_target, key) => (state().value as any)[key],
    has: (_target, key) => key in (state().value as any),
    ownKeys: () => Reflect.ownKeys(state().value as any),
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
  });
  const result = render(() => createComponent(live));
  return {
    ...result,
    async setProps(next: Partial<P>) {
      setState((previous) => ({ value: { ...previous.value, ...next } }));
      flush();
      await flushMicrotasks();
    },
  };
}

/**
 * Upstream's `clock`: fake timers for every test of the suite, and helpers that advance them and
 * flush Solid's updates.
 */
export function createClock() {
  return {
    withFakeTimers() {
      beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: false });
      });
      afterEach(() => {
        vi.useRealTimers();
      });
    },
    tick(ms: number) {
      vi.advanceTimersByTime(ms);
      flush();
    },
    async tickAsync(ms: number) {
      await vi.advanceTimersByTimeAsync(ms);
      flush();
      await flushMicrotasks();
    },
  };
}

/**
 * @internal
 */
export function Button() {
  const { add } = Toast.useToastManager();
  return (
    <button
      type="button"
      onClick={() => {
        add({
          title: 'title',
          description: 'description',
          actionProps: {
            id: 'action',
            children: 'action',
          },
        });
      }}
    >
      add
    </button>
  );
}

/**
 * @internal
 */
export function List() {
  const toastManager = Toast.useToastManager();
  return (
    <For each={toastManager.toasts}>
      {(toastItem) => (
        <Toast.Root toast={toastItem} data-testid="root">
          <Toast.Title data-testid="title" />
          <Toast.Description data-testid="description" />
          <Toast.Close aria-label="close-press" />
          <Toast.Action data-testid="action" />
        </Toast.Root>
      )}
    </For>
  );
}
