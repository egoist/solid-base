import {
  createSignal,
  flush,
  For,
  onCleanup,
  onSettled,
  Show,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { FloatingFocusManager } from '../focus/FloatingFocusManager';
import { createTestFloating } from '../testUtils';
import { FloatingPortal, FloatingPortalLite, type PortalContainer } from './FloatingPortal';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

function Floating(props: { setFloating: (element: HTMLElement | null) => void }) {
  onCleanup(() => props.setFloating(null));
  return <div ref={(element) => props.setFloating(element)} data-testid="floating" />;
}

function App(props: { container?: PortalContainer }) {
  const [open, setOpen] = createSignal(false, { ownedWrite: true });
  const { refs } = createTestFloating({
    open,
    onOpenChange: (nextOpen) => setOpen(nextOpen),
  });

  return (
    <>
      <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen(!open())} />
      <FloatingPortal container={props.container}>
        <Show when={open()}>
          <Floating setFloating={refs.setFloating} />
        </Show>
      </FloatingPortal>
    </>
  );
}

/**
 * Records the parent of every portal element (`[data-base-ui-portal]`) the moment it's inserted
 * into the document. Solid calls ref callbacks when the element is created, before it is
 * inserted, so upstream's `ref={(node) => parents.add(node.parentNode)}` is observed this way.
 */
function observePortalParents() {
  const parents = new Set<ParentNode | null>();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          const portals = node.matches('[data-base-ui-portal]')
            ? [node]
            : Array.from(node.querySelectorAll('[data-base-ui-portal]'));
          portals.forEach((portal) => parents.add(portal.parentNode));
        }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return {
    parents,
    stop() {
      observer.takeRecords();
      observer.disconnect();
    },
  };
}

describe('FloatingPortal', () => {
  test('allows custom containers', async () => {
    const customRoot = document.createElement('div');
    customRoot.id = 'custom-root';
    document.body.appendChild(customRoot);
    render(() => <App container={customRoot} />);
    fireEvent.click(screen.getByTestId('reference'));

    await flushMicrotasks();

    const parent = screen.getByTestId('floating').parentElement;
    expect(parent?.hasAttribute('data-base-ui-portal')).toBe(true);
    expect(parent?.parentElement).toBe(customRoot);
    customRoot.remove();
  });

  test('allows refs as containers', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const ref = { current: el };
    render(() => <App container={ref} />);
    fireEvent.click(screen.getByTestId('reference'));
    await flushMicrotasks();
    const parent = screen.getByTestId('floating').parentElement;
    expect(parent?.hasAttribute('data-base-ui-portal')).toBe(true);
    expect(parent?.parentElement).toBe(el);
    document.body.removeChild(el);
  });

  test('allows containers to be initially null', async () => {
    function RootApp() {
      const [container, setContainer] = createSignal<HTMLElement | null>(null, {
        ownedWrite: true,
      });
      const [renderContainer, setRenderContainer] = createSignal(false, { ownedWrite: true });

      onSettled(() => {
        setRenderContainer(true);
      });

      return (
        <>
          <Show when={renderContainer()}>
            <div ref={(el) => setContainer(el)} data-testid="root" />
          </Show>
          <App container={container()} />
        </>
      );
    }

    render(() => <RootApp />);
    await flushMicrotasks();

    fireEvent.click(screen.getByTestId('reference'));
    await flushMicrotasks();

    const subRoot = screen.getByTestId('floating').parentElement;
    const root = screen.getByTestId('root');
    expect(root).toBe(subRoot?.parentElement);
  });

  test('reattaches the portal when the container changes', async () => {
    const customRoot = document.createElement('div');
    document.body.appendChild(customRoot);

    try {
      function RootSwitcher() {
        const [container, setContainer] = createSignal<PortalContainer>(undefined);

        return (
          <>
            <App container={container()} />
            <button onClick={() => setContainer(undefined)} data-testid="use-undefined" />
            <button onClick={() => setContainer(customRoot)} data-testid="use-element" />
          </>
        );
      }

      render(() => <RootSwitcher />);

      fireEvent.click(screen.getByTestId('reference'));

      expect((await screen.findByTestId('floating')).parentElement?.parentElement).toBe(
        document.body,
      );

      fireEvent.click(screen.getByTestId('use-element'));
      await flushMicrotasks();

      expect((await screen.findByTestId('floating')).parentElement?.parentElement).toBe(customRoot);

      fireEvent.click(screen.getByTestId('use-undefined'));
      await flushMicrotasks();

      const floatingInBodyAgain = await screen.findByTestId('floating');
      expect(floatingInBodyAgain.parentElement?.parentElement).toBe(document.body);
      expect(customRoot.contains(floatingInBodyAgain)).toBe(false);
    } finally {
      customRoot.remove();
    }
  });

  test('forwards HTML props to the portal element', async () => {
    render(() => (
      <FloatingPortal data-testid="portal-element" class="closed">
        <div />
      </FloatingPortal>
    ));

    await flushMicrotasks();

    const portal = document.querySelector('[data-testid="portal-element"]') as HTMLElement | null;
    expect(portal).not.toBeNull();
    expect(portal).toHaveClass('closed');
    expect(portal).toHaveAttribute('data-base-ui-portal');
  });

  test('uses the rendered portal ID for the aria-owns relationship', async () => {
    function Test() {
      const { store, refs } = createTestFloating({ open: () => true });

      return (
        <FloatingPortal id="custom-portal">
          <FloatingFocusManager store={store} modal={false}>
            <div ref={refs.setFloating} />
          </FloatingFocusManager>
        </FloatingPortal>
      );
    }

    render(() => <Test />);
    await flushMicrotasks();

    expect(document.querySelector('[aria-owns]')).toHaveAttribute('aria-owns', 'custom-portal');
  });

  test('FloatingPortalLite forwards HTML props to the portal element', async () => {
    render(() => (
      <FloatingPortalLite data-testid="lite-portal">
        <div />
      </FloatingPortalLite>
    ));

    await flushMicrotasks();

    const portal = document.querySelector('[data-testid="lite-portal"]');
    expect(portal).not.toBeNull();
  });
});

describe.each([
  { name: 'FloatingPortal', Portal: FloatingPortal },
  { name: 'FloatingPortalLite', Portal: FloatingPortalLite },
])('$name container resolution', ({ Portal }) => {
  // Upstream also runs each case in React StrictMode (`strict: true`), which has no Solid
  // equivalent.
  test.each([{ ancestor: true }, { ancestor: false }])(
    'mounts directly inside a ref attached later in the commit (ancestor=$ancestor)',
    async ({ ancestor }) => {
      const observed = observePortalParents();
      function Test() {
        const container: RefObject<HTMLDivElement | null> = { current: null };
        const content = () => (
          <Portal container={container}>
            <div data-testid="content" />
          </Portal>
        );
        return ancestor ? (
          <div ref={(el) => (container.current = el)} data-testid="container">
            {content()}
          </div>
        ) : (
          <>
            {content()}
            <div ref={(el) => (container.current = el)} data-testid="container" />
          </>
        );
      }

      render(() => <Test />);
      await flushMicrotasks();
      observed.stop();

      const container = screen.getByTestId('container');
      expect(container).toContainElement(screen.getByTestId('content'));
      // The portal must never mount in the fallback container, even temporarily.
      expect(observed.parents).toEqual(new Set([container]));
    },
  );

  test('mounts inside an ancestor ref before the next paint', async () => {
    const [visible, setVisible] = createSignal(false);

    function Content() {
      const container: RefObject<HTMLDivElement | null> = { current: null };
      return (
        <div ref={(el) => (container.current = el)} data-testid="container">
          <Portal container={container}>
            <div data-testid="content" />
          </Portal>
        </div>
      );
    }

    render(() => (
      <Show when={visible()}>
        <Content />
      </Show>
    ));
    expect(screen.queryByTestId('container')).toBe(null);

    // Both callbacks run in one frame with a microtask checkpoint between them, so the second
    // one sees the DOM that the browser paints.
    const mountedBeforePaint = await new Promise<boolean>((resolve) => {
      requestAnimationFrame(() => {
        setVisible(true);
        flush();
      });
      requestAnimationFrame(() => {
        resolve(screen.getByTestId('container').contains(screen.queryByTestId('content')));
      });
    });

    expect(mountedBeforePaint).toBe(true);
  });

  // Upstream's view transition tests (React.ViewTransition/Activity + document.startViewTransition)
  // are skipped in JSDOM and rely on React-only APIs.
  // Upstream's "keeps content connected when an indicator exit removes the container" needs real
  // animations (skipped in JSDOM) and Checkbox, which isn't ported yet.

  test('mounts children once in a connected container when a later update replaces its ref', async () => {
    const mounts: boolean[] = [];

    function Child() {
      let node!: HTMLDivElement;
      onSettled(() => {
        mounts.push(node.isConnected);
      });
      return <div ref={node} data-testid="content" />;
    }

    function Test() {
      // A ref object isn't reactive in Solid: the container element is held in a signal, which
      // is what upstream's re-render re-reading `ref.current` amounts to.
      const [container, setContainer] = createSignal<HTMLDivElement | null>(null, {
        ownedWrite: true,
      });
      const [step, setStep] = createSignal(0, { ownedWrite: true });
      // Two later updates, each flushed on its own (upstream's re-renders).
      advance = () => {
        setStep(1);
        flush();
        setStep(2);
        flush();
      };

      return (
        <>
          <Portal container={() => container()} data-testid="portal">
            <Child />
          </Portal>
          <Show
            when={step() < 2}
            fallback={<div ref={(el) => setContainer(el)} data-testid="second" />}
          >
            <div ref={(el) => setContainer(el)} data-testid="first" />
          </Show>
        </>
      );
    }

    let advance!: () => void;
    render(() => <Test />);
    advance();
    await flushMicrotasks();

    expect(screen.getByTestId('portal').parentElement).toBe(screen.getByTestId('second'));
    expect(mounts).toEqual([true]);
  });

  test('mounts deeply nested portals inside their ancestor refs', async () => {
    function Nested(props: { remaining: number }) {
      const container: RefObject<HTMLDivElement | null> = { current: null };
      return (
        <div ref={(el) => (container.current = el)} data-testid="nested-container">
          <Portal container={container} data-testid="nested-portal">
            {props.remaining > 1 ? (
              <Nested remaining={props.remaining - 1} />
            ) : (
              <div data-testid="leaf" />
            )}
          </Portal>
        </div>
      );
    }

    render(() => <Nested remaining={18} />);
    await flushMicrotasks();

    await waitFor(() => expect(screen.getByTestId('leaf')).toBeInTheDocument());
    expect(screen.getAllByTestId('nested-portal').map((node) => node.parentElement)).toEqual(
      screen.getAllByTestId('nested-container'),
    );
  });

  test('mounts sibling portals inside their container refs', async () => {
    // Upstream also counts React Profiler commits, which has no Solid equivalent.
    function Item() {
      const container: RefObject<HTMLDivElement | null> = { current: null };
      return (
        <div ref={(el) => (container.current = el)} data-testid="container">
          <Portal container={container}>
            <div data-testid="content" />
          </Portal>
        </div>
      );
    }

    render(() => <For each={Array.from({ length: 20 })}>{() => <Item />}</For>);
    await flushMicrotasks();

    expect(screen.getAllByTestId('content')).toHaveLength(20);
    expect(
      screen.getAllByTestId('content').map((node) => node.parentElement?.parentElement),
    ).toEqual(screen.getAllByTestId('container'));
  });

  test.each([{ nested: false }, { nested: true }])(
    'uses the fallback container when a ref stays empty (nested=$nested)',
    async ({ nested }) => {
      const container: RefObject<HTMLDivElement | null> = { current: null };
      const content = (): JSX.Element => (
        <Portal container={container} data-testid="portal">
          <div data-testid="content" />
        </Portal>
      );

      render(() =>
        nested ? <FloatingPortal data-testid="parent">{content()}</FloatingPortal> : content(),
      );
      await flushMicrotasks();

      const fallback = nested ? screen.getByTestId('parent') : document.body;
      expect(screen.getByTestId('portal').parentElement).toBe(fallback);
      expect(fallback).toContainElement(screen.getByTestId('content'));
    },
  );

  test.each([{ clear: false }, { clear: true }])(
    'cancels a queued container check when the container prop changes (clear=$clear)',
    async ({ clear }) => {
      function Test() {
        const firstContainer: RefObject<HTMLDivElement | null> = { current: null };
        const secondContainer: RefObject<HTMLDivElement | null> = { current: null };
        const [step, setStep] = createSignal(0, { ownedWrite: true });
        // Two later updates, each flushed on its own (upstream's re-renders).
        advance = () => {
          setStep(1);
          flush();
          setStep(2);
          flush();
        };

        const container = () => {
          if (step() < 2) {
            return firstContainer;
          }
          return clear ? null : secondContainer.current;
        };

        return (
          <>
            <Portal container={container()} data-testid="portal">
              <div data-testid="content" />
            </Portal>
            <div ref={(el) => (firstContainer.current = el)} data-testid="first" />
            <div ref={(el) => (secondContainer.current = el)} data-testid="second" />
          </>
        );
      }

      let advance!: () => void;
      render(() => <Test />);
      advance();
      await flushMicrotasks();

      expect(screen.getByTestId('first')).toBeEmptyDOMElement();
      expect(screen.queryByTestId('portal')?.parentElement ?? null).toBe(
        clear ? null : screen.getByTestId('second'),
      );
    },
  );
});
