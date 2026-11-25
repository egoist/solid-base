import { createSignal, flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';

/**
 * Renders `ui` and returns a `user-event` instance along with the render result.
 */
export function renderWithUser(
  ui: () => JSX.Element,
  options?: Parameters<typeof render>[1],
): ReturnType<typeof render> & { user: ReturnType<typeof userEvent.setup> } {
  const user = userEvent.setup();
  const result = render(ui, options);
  return { ...result, user };
}

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

export function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Renders `createComponent(props)` and returns a `setProps` that merges new props in, like
 * upstream's `setProps`. Props are exposed through getters, so the component sees the latest
 * values.
 */
export function renderWithProps<P extends object>(
  createComponent: (props: P) => JSX.Element,
  initialProps: P,
  options?: Parameters<typeof render>[1],
) {
  const [state, setState] = createSignal<{ value: P }>({ value: initialProps }, { ownedWrite: true });
  const props = () => state().value;
  const keys = new Set<string>(Object.keys(initialProps));
  const live = new Proxy({} as P, {
    get: (_target, key) => (props() as any)[key],
    has: (_target, key) => key in (props() as any),
    ownKeys: () => Array.from(new Set([...keys, ...Object.keys(props() as any)])),
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
  });
  const result = renderWithUser(() => createComponent(live), options);
  return {
    ...result,
    async setProps(next: Partial<P>) {
      Object.keys(next).forEach((key) => keys.add(key));
      setState((previous) => ({ value: { ...previous.value, ...next } }));
      flush();
      await flushMicrotasks();
    },
  };
}

interface ConformanceProps {
  ref?: (element: any) => void;
  class?: any;
  style?: any;
  render?: any;
  'data-testid'?: string;
}

/**
 * The Solid counterpart of upstream's `describeConformance`: checks that a part forwards its
 * `ref`, `class` (string and state callback), `style`, extra props and `render` prop.
 *
 * @param renderPart Renders the part (with the given props) inside its required ancestors.
 */
export function describeConformance(
  renderPart: (props: ConformanceProps) => JSX.Element,
  options: { refInstanceof: any; tagName?: string },
) {
  describe('conformance', () => {
    it('forwards the ref', async () => {
      let ref: Element | undefined;
      render(() =>
        renderPart({
          ref: (element: Element) => {
            ref = element;
          },
          'data-testid': 'part',
        }),
      );
      await flushMicrotasks();
      expect(ref).toBeInstanceOf(options.refInstanceof);
      expect(ref).toBe(screen.getByTestId('part'));
    });

    it('applies class, class callbacks and style', async () => {
      render(() =>
        renderPart({
          class: (state: unknown) => ['custom', state != null && 'from-state'],
          style: { color: 'red' },
          'data-testid': 'part',
        }),
      );
      await flushMicrotasks();
      const part = screen.getByTestId('part');
      expect(part).toHaveClass('custom', 'from-state');
      expect(part).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });

    it('supports the render prop', async () => {
      render(() =>
        renderPart({
          render: (props: Record<string, unknown>) => <section {...props} data-rendered="" />,
          'data-testid': 'part',
        }),
      );
      await flushMicrotasks();
      const part = screen.getByTestId('part');
      expect(part.tagName).toBe('SECTION');
      expect(part).toHaveAttribute('data-rendered');
    });
  });
}
