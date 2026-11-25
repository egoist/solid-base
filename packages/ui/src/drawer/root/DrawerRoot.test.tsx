/*
 * Browser-only upstream (skipIf(isJSDOM)), not ported:
 * - uses a size-based swipe threshold
 * - clears swipe-dismiss styles when swipe close is canceled
 * - does not dismiss a controlled drawer via swipe when open is always true
 * - does not restore snap point when a controlled swipe close is accepted by the parent
 * - restores snap point and swipe offsets when swipe close is canceled
 * - damps active snap point overshoot after the swipe direction is established
 * - allows dragging past a snap point when snapToSequentialPoints is enabled
 * - stays on the current snap point after repeated stationary samples
 * - advances to the next snap point on fast flicks when snapToSequentialPoints is enabled
 * - keeps the drawer open on low-velocity swipes near a snap point
 * - keeps the drawer open when the release velocity reverses during an upward swipe
 * - chooses the nearest sequential snap point on a slow drag
 * - advances a sequential snap point toward dismissal
 * - dismisses past the final sequential snap point
 * - dismisses when a slow snap-point drag ends closer to closed
 * - dismisses from upward snap points using upward velocity
 * - opens from a controlled null snap point
 * - dismisses from a controlled null snap point
 * - keeps the first sequential snap point on a fast opening flick
 * - keeps the current snap point after a sub-threshold drag
 * - dismisses a non-sequential snap point when closed is nearest
 * - finishes a controlled accepted dismissal while kept mounted
 * - restores a snap point when a controlled parent rejects dismissal
 * - closes an uncontrolled drawer after a slow long drag
 *
 * React-specific upstream tests, not ported: "reports and unregisters $label before passive
 * effects" (React passive effect timing, Strict Mode and the React 17 `useId` fallback). The
 * provider registration itself is covered below.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Show, createRoot, createSignal, flush, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library';
import { Drawer, DrawerCloseDataAttributes, DrawerTriggerDataAttributes } from '..';
import { REASONS } from '../../internals/reasons';
import { act, flushMicrotasks, renderWithProps, renderWithUser } from '../../dialog/test-utils';
import { useDrawerRootContext } from './DrawerRootContext';

vi.mock('@egoist/solid-base-utils/platform', async () => {
  const actual = await vi.importActual<typeof import('@egoist/solid-base-utils/platform')>(
    '@egoist/solid-base-utils/platform',
  );
  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, android: true },
    },
  };
});

type NumberPayload = { readonly payload: number | undefined };

function SnapPointResetCase() {
  const snapPoints = ['100px', '300px', 1];
  const [open, setOpen] = createSignal(true);
  const [snapPoint, setSnapPoint] = createSignal<Drawer.Root.SnapPoint | null>(snapPoints[2]);

  return (
    <div>
      <div data-testid="active-snap">{String(snapPoint())}</div>
      <Drawer.Root
        open={open()}
        onOpenChange={(next) => setOpen(next)}
        snapPoints={snapPoints}
        snapPoint={snapPoint()}
        onSnapPointChange={(next) => setSnapPoint(() => next)}
      >
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              Drawer
              <Drawer.Close data-testid="close">Close</Drawer.Close>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

function ActiveSnapPointDisplay() {
  const context = useDrawerRootContext();
  return <div data-testid="active-snap">{String(context.activeSnapPoint)}</div>;
}

function DefaultSnapPointResetCase() {
  const snapPoints = ['100px', '300px', 1];
  const [open, setOpen] = createSignal(true);

  return (
    <Drawer.Root
      defaultSnapPoint={snapPoints[1]}
      open={open()}
      onOpenChange={(next) => setOpen(next)}
      snapPoints={snapPoints}
    >
      <ActiveSnapPointDisplay />
      <Drawer.Portal>
        <Drawer.Viewport data-testid="viewport">
          <Drawer.Popup data-testid="popup">
            Drawer
            <Drawer.Close data-testid="close">Close</Drawer.Close>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function SnapPointChangeDetailsCase(props: {
  onSnapPointChange: (
    snapPoint: Drawer.Root.SnapPoint | null,
    eventDetails: Drawer.Root.SnapPointChangeEventDetails,
  ) => void;
}) {
  const snapPoints = ['100px', '300px', 1];
  const [open, setOpen] = createSignal(true);
  const [snapPoint, setSnapPoint] = createSignal<Drawer.Root.SnapPoint | null>(snapPoints[2]);

  return (
    <Drawer.Root
      open={open()}
      onOpenChange={(next) => setOpen(next)}
      snapPoints={snapPoints}
      snapPoint={snapPoint()}
      onSnapPointChange={(nextSnapPoint, eventDetails) => {
        setSnapPoint(() => nextSnapPoint);
        props.onSnapPointChange(nextSnapPoint, eventDetails);
      }}
    >
      <Drawer.Portal>
        <Drawer.Viewport data-testid="viewport">
          <Drawer.Popup data-testid="popup">
            Drawer
            <Drawer.Close data-testid="close">Close</Drawer.Close>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function CanceledCloseSnapPointResetCase() {
  const snapPoints = ['100px', '300px', 1];
  const [open, setOpen] = createSignal(true);
  const [snapPoint, setSnapPoint] = createSignal<Drawer.Root.SnapPoint | null>(snapPoints[2]);

  return (
    <div>
      <div data-testid="active-snap">{String(snapPoint())}</div>
      <Drawer.Root
        open={open()}
        onOpenChange={(nextOpen, eventDetails) => {
          if (!nextOpen) {
            eventDetails.cancel();
          } else {
            setOpen(nextOpen);
          }
        }}
        snapPoints={snapPoints}
        snapPoint={snapPoint()}
        onSnapPointChange={(next) => setSnapPoint(() => next)}
      >
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              Drawer
              <Drawer.Close data-testid="close">Close</Drawer.Close>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

function SnapPointContextControls() {
  const context = useDrawerRootContext();

  return (
    <>
      <output data-testid="context-active-snap-point">{String(context.activeSnapPoint)}</output>
      <button onClick={() => context.setActiveSnapPoint('100px')}>Set canceled snap point</button>
      <button onClick={() => context.setActiveSnapPoint(999)}>Set invalid snap point</button>
    </>
  );
}

function NestedSwipeProgressProbe() {
  const context = useDrawerRootContext();
  const store = context.nestedSwipeProgressStore;
  const [progress, setProgress] = createSignal(store.getSnapshot());

  onSettled(() => store.subscribe(() => setProgress(store.getSnapshot())));

  return <output data-testid="nested-swipe-progress">{progress()}</output>;
}

function NestedSwipeProgressSubscriber(props: { onChange: () => void }) {
  const context = useDrawerRootContext();

  onSettled(() => context.nestedSwipeProgressStore.subscribe(() => props.onChange()));

  return null;
}

function NestedSwipeProgressControls() {
  const context = useDrawerRootContext();

  return (
    <>
      <button onClick={() => context.onNestedSwipeProgressChange(0.5)}>Set nested progress</button>
      <button onClick={() => context.onNestedSwipeProgressChange(Number.NaN)}>
        Set invalid nested progress
      </button>
    </>
  );
}

function MissingRootContextConsumer() {
  useDrawerRootContext();
  return null;
}

describe('<Drawer.Root />', () => {
  it('exposes the attributes rendered by borrowed trigger and close parts', async () => {
    const { user } = renderWithUser(() => (
      <Drawer.Root modal={false}>
        <Drawer.Trigger>Open</Drawer.Trigger>
        <Drawer.Trigger disabled>Disabled</Drawer.Trigger>
        <Drawer.Close disabled>Close</Drawer.Close>
      </Drawer.Root>
    ));

    const disabledTrigger = screen.getByRole('button', { name: 'Disabled' });
    expect(disabledTrigger).toHaveAttribute(DrawerTriggerDataAttributes.disabled);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    expect(closeButton).toHaveAttribute(DrawerCloseDataAttributes.disabled);

    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);
    flush();
    expect(trigger).toHaveAttribute(DrawerTriggerDataAttributes.popupOpen);
  });

  it('opens with the trigger and closes on a swipe past the threshold', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <Drawer.Root onOpenChange={handleOpenChange}>
        <Drawer.Trigger>Open</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    flush();
    await flushMicrotasks();

    const popup = screen.getByTestId('popup');
    const viewport = screen.getByTestId('viewport');
    Object.defineProperty(popup, 'offsetHeight', { configurable: true, value: 200 });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;
    try {
      const pointer = { pointerId: 1, pointerType: 'mouse', clientX: 0 };
      fireEvent.pointerDown(viewport, { ...pointer, button: 0, buttons: 1, clientY: 0 });
      fireEvent.pointerMove(viewport, { ...pointer, buttons: 1, clientY: 50 });
      fireEvent.pointerMove(viewport, { ...pointer, buttons: 1, clientY: 150 });
      flush();
      expect(popup).toHaveAttribute('data-swiping');
      fireEvent.pointerUp(viewport, { ...pointer, button: 0, buttons: 0, clientY: 150 });
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
    flush();
    await flushMicrotasks();

    expect(handleOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: REASONS.swipe }),
    );
    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  it('supports detached triggers with handles', async () => {
    const handle = Drawer.createHandle<number>();

    render(() => (
      <div>
        <Drawer.Trigger handle={handle} payload={1}>
          Trigger 1
        </Drawer.Trigger>
        <Drawer.Trigger handle={handle} payload={2}>
          Trigger 2
        </Drawer.Trigger>
        <Drawer.Root handle={handle}>
          {(arg: NumberPayload) => (
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup>
                  <span data-testid="payload">{arg.payload}</span>
                  <Drawer.Close>Close</Drawer.Close>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          )}
        </Drawer.Root>
      </div>
    ));

    expect(screen.queryByTestId('payload')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Trigger 1' }));
    flush();
    await flushMicrotasks();
    expect(screen.getByTestId('payload').textContent).toBe('1');

    fireEvent.click(screen.getByText('Close'));
    flush();
    await flushMicrotasks();
    await waitFor(() => {
      expect(screen.queryByTestId('payload')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger 2' }));
    flush();
    await flushMicrotasks();
    expect(screen.getByTestId('payload').textContent).toBe('2');
  });

  it('does not re-render inactive detached triggers when the popup opens and closes', async () => {
    const handle = Drawer.createHandle();
    const bystander = { renders: 0 };

    const { user } = renderWithUser(() => (
      <div>
        <Drawer.Trigger handle={handle}>Trigger 1</Drawer.Trigger>
        <Drawer.Trigger
          handle={handle}
          render={(props) => {
            bystander.renders += 1;
            return <button {...(props as JSX.HTMLAttributes<HTMLButtonElement>)} />;
          }}
        >
          Trigger 2
        </Drawer.Trigger>
        <Drawer.Root handle={handle}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup">
                <Drawer.Close>Close</Drawer.Close>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    ));

    const trigger = screen.getByRole('button', { name: 'Trigger 1' });

    async function openAndClose() {
      await user.click(trigger);
      expect(await screen.findByTestId('popup')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await user.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }

    bystander.renders = 0;
    await openAndClose();
    await openAndClose();
    expect(bystander.renders).toBe(0);
  });

  it('supports imperative actions with handles', async () => {
    const handle = Drawer.createHandle<number>();

    render(() => (
      <div>
        <Drawer.Trigger handle={handle} id="trigger-1" payload={1}>
          Trigger 1
        </Drawer.Trigger>
        <Drawer.Trigger handle={handle} id="trigger-2" payload={2}>
          Trigger 2
        </Drawer.Trigger>
        <Drawer.Root handle={handle}>
          {(arg: NumberPayload) => (
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup data-testid="content">{arg.payload}</Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          )}
        </Drawer.Root>
      </div>
    ));

    const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
    const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
    expect(screen.queryByRole('dialog')).toBe(null);

    await act(() => handle.open('trigger-2'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBe(null);
    });

    expect(screen.getByTestId('content').textContent).toBe('2');
    expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    expect(trigger2.getAttribute('aria-controls')).toBe(
      screen.getByRole('dialog').getAttribute('id'),
    );
    expect(trigger1).toHaveAttribute('aria-expanded', 'false');

    await act(() => handle.close());
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null);
    });
    expect(trigger2).toHaveAttribute('aria-expanded', 'false');

    await act(() => handle.openWithPayload(8));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBe(null);
    });
    expect(screen.getByTestId('content').textContent).toBe('8');
    expect(trigger1).toHaveAttribute('aria-expanded', 'false');
    expect(trigger2).toHaveAttribute('aria-expanded', 'false');
  });

  it('attaches fresh root state when a handle-backed root remounts', async () => {
    const handle = Drawer.createHandle<number>();

    function App() {
      const [mounted, setMounted] = createSignal(true);

      return (
        <>
          <Drawer.Trigger handle={handle} id="trigger" payload={1}>
            Trigger
          </Drawer.Trigger>
          <Show when={!mounted()}>
            <button type="button" onClick={() => setMounted(true)}>
              Remount root
            </button>
          </Show>
          <Show when={mounted()}>
            <Drawer.Root handle={handle}>
              {(arg: NumberPayload) => (
                <>
                  <span data-testid="payload">{arg.payload ?? 'No payload'}</span>
                  <Drawer.Portal>
                    <Drawer.Viewport>
                      <Drawer.Popup>
                        Drawer content
                        <button type="button" onClick={() => setMounted(false)}>
                          Unmount root
                        </button>
                      </Drawer.Popup>
                    </Drawer.Viewport>
                  </Drawer.Portal>
                </>
              )}
            </Drawer.Root>
          </Show>
        </>
      );
    }

    const { user } = renderWithUser(() => <App />);
    const trigger = screen.getByRole('button', { name: 'Trigger' });

    expect(screen.getByTestId('payload').textContent).toBe('No payload');

    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Drawer content')).toBeVisible();
    });
    expect(screen.getByTestId('payload').textContent).toBe('1');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.getAttribute('aria-controls')).toBe(
      screen.getByRole('dialog').getAttribute('id'),
    );

    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Unmount root' }),
    );
    flush();
    expect(handle.isOpen).toBe(false);
    expect(screen.queryByText('Drawer content')).toBe(null);

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    handle.openWithPayload(8);
    handle.open('trigger');
    handle.close();
    const detachedWarnings = consoleWarn.mock.calls.filter(
      ([message]) =>
        typeof message === 'string' && message.includes('no root using this handle is mounted'),
    );
    consoleWarn.mockRestore();

    expect(handle.isOpen).toBe(false);
    expect(detachedWarnings).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Remount root' }));
    flush();
    expect(screen.getByTestId('payload').textContent).toBe('No payload');
    expect(screen.queryByText('Drawer content')).toBe(null);
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
    expect(trigger).not.toHaveAttribute('aria-controls');

    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Drawer content')).toBeVisible();
    });
    expect(screen.getByTestId('payload').textContent).toBe('1');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.getAttribute('aria-controls')).toBe(
      screen.getByRole('dialog').getAttribute('id'),
    );
  });

  it('synchronizes trigger aria-controls with the popup id', async () => {
    const { user } = renderWithUser(() => (
      <Drawer.Root>
        <Drawer.Trigger>Open</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).not.toBe(null);
    });

    const popup = screen.getByTestId('popup');
    expect(trigger.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));
  });

  it('resets the active snap point when closing', async () => {
    render(() => <SnapPointResetCase />);

    fireEvent.click(screen.getByTestId('close'));
    flush();
    await flushMicrotasks();

    expect(screen.getByTestId('active-snap').textContent).toBe('100px');
  });

  it('resets to the default snap point when provided', async () => {
    render(() => <DefaultSnapPointResetCase />);

    expect(screen.getByTestId('active-snap').textContent).toBe('300px');

    fireEvent.click(screen.getByTestId('close'));
    flush();
    await flushMicrotasks();

    expect(screen.getByTestId('active-snap').textContent).toBe('300px');
  });

  it('provides event details when snap point changes', async () => {
    const handleSnapPointChange = vi.fn();
    render(() => <SnapPointChangeDetailsCase onSnapPointChange={handleSnapPointChange} />);

    fireEvent.click(screen.getByTestId('close'));
    flush();
    await flushMicrotasks();

    expect(handleSnapPointChange).toHaveBeenCalled();
    const [, eventDetails] = handleSnapPointChange.mock.calls[0];
    expect(eventDetails.reason).toBe(REASONS.closePress);
  });

  it('does not reset snap point when a close is canceled', async () => {
    render(() => <CanceledCloseSnapPointResetCase />);

    expect(screen.getByTestId('active-snap').textContent).toBe('1');

    fireEvent.click(screen.getByTestId('close'));
    flush();
    await flushMicrotasks();

    expect(screen.getByTestId('active-snap').textContent).toBe('1');
  });

  it('honors canceled snap point changes and falls back from invalid uncontrolled values', async () => {
    const handleSnapPointChange = vi.fn(
      (
        nextSnapPoint: Drawer.Root.SnapPoint | null,
        eventDetails: Drawer.Root.SnapPointChangeEventDetails,
      ) => {
        if (nextSnapPoint === '100px') {
          eventDetails.cancel();
        }
      },
    );
    const { user } = renderWithUser(() => (
      <Drawer.Root
        defaultSnapPoint="300px"
        onSnapPointChange={handleSnapPointChange}
        snapPoints={['100px', '300px']}
      >
        <SnapPointContextControls />
      </Drawer.Root>
    ));

    expect(screen.getByTestId('context-active-snap-point').textContent).toBe('300px');

    await user.click(screen.getByRole('button', { name: 'Set canceled snap point' }));
    flush();
    expect(screen.getByTestId('context-active-snap-point').textContent).toBe('300px');

    await user.click(screen.getByRole('button', { name: 'Set invalid snap point' }));
    flush();
    expect(screen.getByTestId('context-active-snap-point').textContent).toBe('300px');
    expect(handleSnapPointChange).toHaveBeenLastCalledWith(
      999,
      expect.objectContaining({ reason: REASONS.none }),
    );
  });

  it('normalizes invalid nested swipe progress without notifying for duplicate values', async () => {
    const handleProgressChange = vi.fn();
    const { user } = renderWithUser(() => (
      <Drawer.Root>
        <NestedSwipeProgressProbe />
        <NestedSwipeProgressSubscriber onChange={handleProgressChange} />
        <Drawer.Root>
          <NestedSwipeProgressControls />
        </Drawer.Root>
      </Drawer.Root>
    ));

    await user.click(screen.getByRole('button', { name: 'Set nested progress' }));
    flush();
    expect(screen.getByTestId('nested-swipe-progress').textContent).toBe('0.5');
    expect(handleProgressChange).toHaveBeenCalledTimes(1);

    handleProgressChange.mockClear();

    await user.click(screen.getByRole('button', { name: 'Set nested progress' }));
    flush();
    expect(screen.getByTestId('nested-swipe-progress').textContent).toBe('0.5');
    expect(handleProgressChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Set invalid nested progress' }));
    flush();
    expect(screen.getByTestId('nested-swipe-progress').textContent).toBe('0');
    expect(handleProgressChange).toHaveBeenCalledTimes(1);
  });

  it('throws a descriptive error when the root context is missing', () => {
    expect(() => createRoot(() => MissingRootContextConsumer())).toThrow(
      'Base UI: DrawerRootContext is missing. Drawer parts must be placed within <Drawer.Root>.',
    );
  });

  it.each([
    { label: 'a controlled drawer', rootProps: { open: true } },
    { label: 'a default-open drawer', rootProps: { defaultOpen: true } },
  ])('reports and unregisters $label with the provider', async ({ rootProps }) => {
    const { setProps } = renderWithProps(
      (props: { showDrawer: boolean }) => (
        <Drawer.Provider>
          <Show when={props.showDrawer}>
            <Drawer.Root modal={false} {...rootProps} />
          </Show>
          <Drawer.IndentBackground data-testid="background" />
        </Drawer.Provider>
      ),
      { showDrawer: true },
    );

    flush();
    expect(screen.getByTestId('background')).toHaveAttribute('data-active', '');

    await setProps({ showDrawer: false });
    expect(screen.getByTestId('background')).toHaveAttribute('data-inactive', '');
  });

  describe('CloseWatcher', () => {
    class CloseWatcherStub extends EventTarget {
      static instances: CloseWatcherStub[] = [];
      active = true;

      constructor() {
        super();
        CloseWatcherStub.instances.push(this);
      }

      destroy() {
        this.active = false;
      }

      // Mirrors the browser: `cancel` fires first and can only be prevented while the page has
      // history-action activation; otherwise the watcher is destroyed before `close` fires.
      requestClose(cancelable: boolean) {
        if (!this.active) {
          return;
        }

        const cancelEvent = new Event('cancel', { cancelable });
        this.dispatchEvent(cancelEvent);
        if (cancelEvent.defaultPrevented) {
          return;
        }

        this.destroy();
        this.dispatchEvent(new Event('close'));
      }
    }

    const win = window as Window & { CloseWatcher?: unknown | undefined };
    const originalCloseWatcher = win.CloseWatcher;

    beforeEach(() => {
      CloseWatcherStub.instances = [];
      win.CloseWatcher = CloseWatcherStub;
    });

    afterEach(() => {
      win.CloseWatcher = originalCloseWatcher;
    });

    function TestDrawer(props: Omit<Drawer.Root.Props, 'children'> & { children?: JSX.Element }) {
      return (
        <Drawer.Root
          defaultOpen={props.defaultOpen}
          open={props.open}
          onOpenChange={props.onOpenChange}
        >
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>{props.children ?? 'Drawer'}</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      );
    }

    function currentWatcher() {
      return CloseWatcherStub.instances[CloseWatcherStub.instances.length - 1];
    }

    async function requestClose(cancelable = true) {
      await act(async () => {
        currentWatcher().requestClose(cancelable);
      });
      await waitFor(() => {
        // Let a pending close finish its exit transition.
        flush();
      });
    }

    async function waitForWatcher() {
      flush();
      await flushMicrotasks();
      await waitFor(() => {
        expect(CloseWatcherStub.instances.length).toBeGreaterThan(0);
      });
    }

    it('closes when the watcher requests a close', async () => {
      const handleOpenChange = vi.fn();
      render(() => <TestDrawer defaultOpen onOpenChange={handleOpenChange} />);
      await waitForWatcher();

      await requestClose();

      expect(handleOpenChange).toHaveBeenCalledExactlyOnceWith(
        false,
        expect.objectContaining({ reason: REASONS.closeWatcher }),
      );
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });
      expect(currentWatcher().active).toBe(false);
    });

    it('keeps the same watcher active when a cancelable close request is canceled', async () => {
      let shouldCancel = true;
      const handleOpenChange = vi.fn((_open: boolean, details: Drawer.Root.ChangeEventDetails) => {
        if (shouldCancel) {
          details.cancel();
        }
      });
      render(() => <TestDrawer defaultOpen onOpenChange={handleOpenChange} />);
      await waitForWatcher();
      const watcher = currentWatcher();
      const instanceCount = CloseWatcherStub.instances.length;

      await requestClose();

      expect(handleOpenChange).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(CloseWatcherStub.instances).toHaveLength(instanceCount);
      expect(watcher.active).toBe(true);

      shouldCancel = false;
      await requestClose();

      expect(handleOpenChange).toHaveBeenCalledTimes(2);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });
      expect(watcher.active).toBe(false);
    });

    it('closes on a close request that cannot be prevented even if onOpenChange cancels it', async () => {
      const handleOpenChange = vi.fn((_open: boolean, details: Drawer.Root.ChangeEventDetails) => {
        details.cancel();
      });
      render(() => <TestDrawer defaultOpen onOpenChange={handleOpenChange} />);
      await waitForWatcher();

      await requestClose(false);

      expect(handleOpenChange).toHaveBeenCalledTimes(1);
      const details = handleOpenChange.mock.calls[0][1];
      expect(details.event.cancelable).toBe(false);
      expect(details.isCanceled).toBe(false);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });
      expect(currentWatcher().active).toBe(false);
    });

    it.each([false, true])(
      'steps through content on back presses until one cannot be prevented (controlled: %s)',
      async (controlled) => {
        function SteppedDrawer() {
          const [open, setOpen] = createSignal(true);
          const [step, setStep] = createSignal(2);
          let currentStep = 2;
          return (
            <TestDrawer
              defaultOpen
              open={controlled ? open() : undefined}
              onOpenChange={(nextOpen, details) => {
                if (currentStep > 0 && details.event.cancelable) {
                  details.cancel();
                  currentStep -= 1;
                  setStep(currentStep);
                  return;
                }
                setOpen(nextOpen);
              }}
            >
              step {step()}
            </TestDrawer>
          );
        }

        render(() => <SteppedDrawer />);
        await waitForWatcher();
        const watcher = currentWatcher();
        const instanceCount = CloseWatcherStub.instances.length;

        await requestClose();
        expect(screen.getByRole('dialog')).toHaveTextContent('step 1');
        expect(CloseWatcherStub.instances).toHaveLength(instanceCount);
        expect(watcher.active).toBe(true);

        await requestClose(false);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(watcher.active).toBe(false);
      },
    );

    it('destroys the watcher on unmount', async () => {
      const handleOpenChange = vi.fn((_open: boolean, details: Drawer.Root.ChangeEventDetails) => {
        details.cancel();
      });
      const { unmount } = render(() => (
        <TestDrawer defaultOpen onOpenChange={handleOpenChange} />
      ));
      await waitForWatcher();
      const watcher = currentWatcher();

      await requestClose();
      expect(watcher.active).toBe(true);

      unmount();
      expect(watcher.active).toBe(false);
    });
  });
});
