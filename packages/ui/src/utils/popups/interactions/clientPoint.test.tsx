import { test, expect, vi } from 'vitest';
import { createMemo, createRoot, createSignal, flush, onCleanup, Show } from 'solid-js';
import type { Coords } from '@floating-ui/dom';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { PopupTriggerMap } from '../popupTriggerMap';
import { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { createTestFloating, getInteractionProps } from '../testUtils';
import { createClientPoint } from './clientPoint';

async function flushMicrotasks() {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  flush();
}

function expectLocation({ x, y }: Coords) {
  expect(Number(screen.getByTestId('x')?.textContent)).toBe(x);
  expect(Number(screen.getByTestId('y')?.textContent)).toBe(y);
  expect(Number(screen.getByTestId('width')?.textContent)).toBe(0);
  expect(Number(screen.getByTestId('height')?.textContent)).toBe(0);
}

function expectRect({ x, y, width, height }: DOMRectInit) {
  expect(Number(screen.getByTestId('x')?.textContent)).toBe(x);
  expect(Number(screen.getByTestId('y')?.textContent)).toBe(y);
  expect(Number(screen.getByTestId('width')?.textContent)).toBe(width);
  expect(Number(screen.getByTestId('height')?.textContent)).toBe(height);
}

function createRootStore(referenceElement: HTMLElement) {
  return new FloatingRootStore({
    open: false,
    anchorElement: referenceElement,
    positionerElement: document.createElement('div'),
    triggerElements: new PopupTriggerMap(),
    defaultPopupId: undefined,
    nested: false,
    onOpenChange: vi.fn(),
  });
}

function App(props: {
  enabled?: boolean;
  axis?: 'both' | 'x' | 'y';
  useTriggerProps?: boolean;
  openWithFocusEvent?: boolean;
}) {
  const [isOpen, setIsOpen] = createSignal(false);
  const { store, refs } = createTestFloating({
    open: isOpen,
    onOpenChange: (open) => setIsOpen(open),
  });
  const clientPoint = createClientPoint(store, {
    get enabled() {
      return props.enabled ?? true;
    },
    get axis() {
      return props.axis;
    },
  });

  const referenceProps = getInteractionProps([clientPoint], 'reference');
  const triggerProps = getInteractionProps([clientPoint], 'trigger');

  // A React component re-renders (and measures the reference again) whenever its state changes.
  const rect = createMemo(() => {
    isOpen();
    return store.select('anchor')?.getBoundingClientRect();
  });

  function handleButtonClick() {
    if (!props.openWithFocusEvent) {
      setIsOpen((v) => !v);
      return;
    }

    store.setOpen(
      true,
      createChangeEventDetails(
        REASONS.triggerFocus,
        new FocusEvent('focus'),
        store.state.anchorElement as HTMLElement,
      ),
    );
  }

  return (
    <>
      <div
        data-testid="reference"
        ref={refs.setReference}
        {...(props.useTriggerProps ? triggerProps : referenceProps)}
        style={{ width: '0px', height: '0px', 'pointer-events': 'none' }}
      >
        Reference
      </div>
      <Show when={isOpen()}>
        <Floating setFloating={refs.setFloating} />
      </Show>
      <button onClick={handleButtonClick} />
      <span data-testid="x">{rect()?.x}</span>
      <span data-testid="y">{rect()?.y}</span>
      <span data-testid="width">{rect()?.width}</span>
      <span data-testid="height">{rect()?.height}</span>
    </>
  );
}

// React calls ref callbacks with `null` on unmount: Solid doesn't, so unregister explicitly.
function Floating(props: { setFloating: (element: HTMLElement | null) => void }) {
  onCleanup(() => props.setFloating(null));
  return (
    <div data-testid="floating" ref={props.setFloating} style={{ 'pointer-events': 'none' }}>
      Floating
    </div>
  );
}

function ClientPointStoreTest(props: { store: FloatingRootStore; enabled?: boolean }) {
  // eslint-disable-next-line solid/reactivity
  createClientPoint(props.store, {
    get enabled() {
      return props.enabled ?? true;
    },
  });
  return null;
}

test('updates position from trigger props', async () => {
  render(() => <App useTriggerProps />);

  await flushMicrotasks();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 400,
      clientY: 200,
    }),
  );

  await flushMicrotasks();

  expectLocation({ x: 400, y: 200 });
});

test('uses trigger element when dom reference is missing', async () => {
  render(() => <App axis="x" />);

  const reference = screen.getByTestId('reference');
  reference.getBoundingClientRect = () => ({
    x: 10,
    y: 50,
    width: 0,
    height: 0,
    top: 50,
    left: 10,
    right: 10,
    bottom: 50,
    toJSON: () => {},
  });

  await flushMicrotasks();

  fireEvent.mouseMove(reference, {
    clientX: 200,
    clientY: 300,
  });

  await flushMicrotasks();

  expectLocation({ x: 200, y: 50 });
});

test('renders at mouse event coords', async () => {
  render(() => <App />);

  await flushMicrotasks();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );

  await flushMicrotasks();

  expectLocation({ x: 500, y: 500 });

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 1000,
      clientY: 1000,
    }),
  );

  await flushMicrotasks();

  expectLocation({ x: 1000, y: 1000 });

  // Window listener isn't registered unless the floating element is open.
  fireEvent(
    window,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 700,
      clientY: 700,
    }),
  );

  await flushMicrotasks();

  expectLocation({ x: 1000, y: 1000 });

  fireEvent.click(screen.getByRole('button'));
  await flushMicrotasks();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 700,
      clientY: 700,
    }),
  );
  await flushMicrotasks();

  expectLocation({ x: 700, y: 700 });

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );
  await flushMicrotasks();

  expectLocation({ x: 0, y: 0 });
});

test('cleans up window listener when closing or disabling', async () => {
  const [enabled, setEnabled] = createSignal(true);
  render(() => <App enabled={enabled()} />);

  fireEvent.click(screen.getByRole('button'));
  flush();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await flushMicrotasks();

  fireEvent.click(screen.getByRole('button'));
  flush();

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );
  await flushMicrotasks();

  expectLocation({ x: 500, y: 500 });

  fireEvent.click(screen.getByRole('button'));
  flush();

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await flushMicrotasks();

  expectLocation({ x: 500, y: 500 });

  setEnabled(false);
  flush();

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );
  await flushMicrotasks();

  expectRect({ x: 0, y: 0, width: 0, height: 0 });
});

test('clears virtual references on unmount without retaining a stale DOM reference', async () => {
  const reference = document.createElement('button');
  const store = createRoot(() => createRootStore(reference));
  const virtualReference = {
    getBoundingClientRect: () => reference.getBoundingClientRect(),
  };

  store.set('anchorOverride', virtualReference);

  const [enabled, setEnabled] = createSignal(true);
  const { unmount } = render(() => <ClientPointStoreTest store={store} enabled={enabled()} />);

  setEnabled(false);
  await flushMicrotasks();

  expect(store.state.anchorOverride).toBe(reference);

  store.set('anchorOverride', virtualReference);
  unmount();

  expect(store.state.anchorOverride).toBe(null);
});

test('axis x', async () => {
  render(() => <App axis="x" />);

  fireEvent.click(screen.getByRole('button'));
  flush();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await flushMicrotasks();

  expectLocation({ x: 500, y: 0 });
});

test('axis y', async () => {
  render(() => <App axis="y" />);

  fireEvent.click(screen.getByRole('button'));
  flush();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await flushMicrotasks();

  expectLocation({ x: 0, y: 500 });
});

test.for([
  {
    axis: 'x',
    atCursor: { x: 500, y: 20, width: 0, height: 40 },
    afterReferenceMoves: { x: 550, y: 70, width: 0, height: 40 },
  },
  {
    axis: 'y',
    atCursor: { x: 10, y: 500, width: 30, height: 0 },
    afterReferenceMoves: { x: 60, y: 550, width: 30, height: 0 },
  },
] as const)(
  'keeps the reference size on the untracked axis when tracking $axis',
  async ({ axis, atCursor, afterReferenceMoves }) => {
    render(() => <App axis={axis} />);

    const reference = screen.getByTestId('reference');
    let referenceRect = { x: 10, y: 20, width: 30, height: 40 };

    reference.getBoundingClientRect = () => {
      const { x, y, width, height } = referenceRect;
      return {
        x,
        y,
        width,
        height,
        top: y,
        right: x + width,
        bottom: y + height,
        left: x,
        toJSON: () => {},
      };
    };

    fireEvent(
      reference,
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: 500,
        clientY: 500,
      }),
    );
    await flushMicrotasks();

    expectRect(atCursor);

    // Opening re-reads the same virtual element as an auto-update. The open wasn't a hover,
    // so the cursor point keeps its offset from the reference instead of snapping back.
    referenceRect = { x: 60, y: 70, width: 30, height: 40 };

    fireEvent.click(screen.getByRole('button'));
    await flushMicrotasks();

    expectRect(afterReferenceMoves);
  },
);

test('removes window listener when cursor lands on floating element', async () => {
  render(() => <App />);

  fireEvent.click(screen.getByRole('button'));
  flush();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );

  fireEvent(
    screen.getByTestId('floating'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );

  await flushMicrotasks();

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );
  flush();

  expectLocation({ x: 500, y: 500 });
});

test('reattaches window listener after cursor returns from floating element to reference', async () => {
  render(() => <App />);

  fireEvent.click(screen.getByRole('button'));
  flush();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );

  fireEvent(
    screen.getByTestId('floating'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );

  await flushMicrotasks();

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );
  flush();

  expectLocation({ x: 500, y: 500 });

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 600,
      clientY: 700,
    }),
  );
  await flushMicrotasks();

  // Reapply deterministic coordinates after the effect attaches the window listener.
  // A real browser cursor can emit an unrelated move while the effect is flushing.
  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 600,
      clientY: 700,
    }),
  );
  flush();

  expectLocation({ x: 600, y: 700 });

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 100,
      clientY: 200,
    }),
  );

  await flushMicrotasks();
  expectLocation({ x: 100, y: 200 });
});

test('restores the DOM reference when opened by a non-mouse event', async () => {
  render(() => <App openWithFocusEvent />);

  const reference = screen.getByTestId('reference');

  reference.getBoundingClientRect = () => ({
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    top: 20,
    right: 40,
    bottom: 60,
    left: 10,
    toJSON: () => {},
  });

  fireEvent(
    reference,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await flushMicrotasks();

  expectLocation({ x: 500, y: 500 });

  fireEvent.click(screen.getByRole('button'));
  await flushMicrotasks();

  expectRect({ x: 10, y: 20, width: 30, height: 40 });

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 100,
      clientY: 200,
    }),
  );

  fireEvent(
    reference,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 300,
      clientY: 400,
    }),
  );
  await flushMicrotasks();

  expectRect({ x: 10, y: 20, width: 30, height: 40 });
});
