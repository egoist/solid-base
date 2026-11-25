/*
 * Browser-only upstream (skipIf(isJSDOM)), not ported:
 * - suppresses a trusted release click that arrives without a preceding pointerdown
 * - allows a later click-only activation to dismiss after a swipe
 * - uses a size-based swipe threshold by default
 * - keeps the swipe-area movement on the popup when re-grabbed during close
 */
import { createEvent, fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Drawer } from '..';
import { act, flushMicrotasks, renderWithProps, wait } from '../../dialog/test-utils';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import type { DrawerProviderContext } from '../provider/DrawerProviderContext';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import type { DialogStore } from '../../dialog/store/DialogStore';

const eventUtilsMockState = vi.hoisted(() => ({ forceVirtualClick: false }));

vi.mock('../../utils/popups/event', async () => {
  const actual = await vi.importActual<typeof import('../../utils/popups/event')>(
    '../../utils/popups/event',
  );
  return {
    ...actual,
    isVirtualClick(...args: Parameters<typeof actual.isVirtualClick>) {
      return eventUtilsMockState.forceVirtualClick || actual.isVirtualClick(...args);
    },
  };
});

type Point = {
  x: number;
  y: number;
};

type SwipeInput = 'pointer' | 'touch';

type SwipeContext = {
  /** Advances the gesture timeline by one step and returns the new timestamp. */
  nextTimeStamp: () => number;
};

type SwipeOptions = {
  beforeRelease?: (context: SwipeContext) => Promise<unknown> | unknown;
  input?: SwipeInput;
  // Applies only to `input: 'pointer'`; the `touch` branch always dispatches touch events.
  pointerType?: 'mouse' | 'pen' | 'touch';
  timeStepMs?: number;
  startTimeMs?: number;
};

type PointerInit = Record<string, unknown> & { timeStamp: number };

/**
 * Fires pointer events that honor the `timeStamp` given to them, so that tests asserting on
 * gesture velocity describe a fixed timeline instead of inheriting the runner's real timing.
 */
function firePointerEvent(
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  element: Element,
  init: PointerInit,
) {
  const { timeStamp, ...eventInit } = init;
  const event = createEvent[type](element, eventInit);
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  return fireEvent(element, event);
}

const firePointer = {
  down: (element: Element, init: PointerInit) => firePointerEvent('pointerDown', element, init),
  move: (element: Element, init: PointerInit) => firePointerEvent('pointerMove', element, init),
  up: (element: Element, init: PointerInit) => firePointerEvent('pointerUp', element, init),
};

function createTouch(target: EventTarget, point: { clientX: number; clientY: number }) {
  if (typeof Touch === 'function') {
    return new Touch({
      identifier: 1,
      target,
      ...point,
    });
  }

  return point;
}

function dispatchTouchPointerEvent(
  element: Element,
  type: string,
  point: { clientX: number; clientY: number },
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerType: { value: 'touch' },
    pointerId: { value: 1 },
    button: { value: 0 },
    buttons: { value: type === 'pointerup' || type === 'pointercancel' ? 0 : 1 },
    clientX: { value: point.clientX },
    clientY: { value: point.clientY },
  });
  element.dispatchEvent(event);
}

async function swipe(element: HTMLElement, start: Point, end: Point, options: SwipeOptions = {}) {
  const stepX = start.x + (end.x === start.x ? 0 : Math.sign(end.x - start.x));
  const stepY = start.y + (end.y === start.y ? 0 : Math.sign(end.y - start.y));
  const {
    beforeRelease,
    input = 'pointer',
    pointerType = 'mouse',
    timeStepMs = 16,
    startTimeMs = 1,
  } = options;
  let timeStamp = startTimeMs;
  const swipeContext: SwipeContext = {
    nextTimeStamp: () => {
      timeStamp += timeStepMs;
      return timeStamp;
    },
  };

  if (input === 'touch') {
    const touchContext: SwipeContext = {
      nextTimeStamp: () => {
        throw new Error("swipe(): `nextTimeStamp` is unavailable for `input: 'touch'`.");
      },
    };

    fireEvent.touchStart(element, {
      bubbles: true,
      touches: [createTouch(element, { clientX: start.x, clientY: start.y })],
    });
    await flushMicrotasks();

    fireEvent.touchMove(element, {
      bubbles: true,
      touches: [createTouch(element, { clientX: stepX, clientY: stepY })],
    });
    await flushMicrotasks();

    fireEvent.touchMove(element, {
      bubbles: true,
      touches: [createTouch(element, { clientX: end.x, clientY: end.y })],
    });
    await flushMicrotasks();

    if (beforeRelease) {
      await beforeRelease(touchContext);
      await flushMicrotasks();
    }

    fireEvent.touchEnd(element, {
      bubbles: true,
      changedTouches: [createTouch(element, { clientX: end.x, clientY: end.y })],
    });
    await flushMicrotasks();
    return;
  }

  firePointer.down(element, {
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: start.x,
    clientY: start.y,
    pointerType,
    timeStamp,
  });
  await flushMicrotasks();

  timeStamp += timeStepMs;
  firePointer.move(element, {
    pointerId: 1,
    clientX: stepX,
    clientY: stepY,
    buttons: 1,
    pointerType,
    timeStamp,
  });
  await flushMicrotasks();

  timeStamp += timeStepMs;
  firePointer.move(element, {
    pointerId: 1,
    clientX: end.x,
    clientY: end.y,
    buttons: 1,
    pointerType,
    timeStamp,
  });
  await flushMicrotasks();

  if (beforeRelease) {
    await beforeRelease(swipeContext);
    await flushMicrotasks();
  }

  timeStamp += timeStepMs;
  firePointer.up(element, {
    pointerId: 1,
    clientX: end.x,
    clientY: end.y,
    pointerType,
    timeStamp,
  });
  await flushMicrotasks();
}

function nextMacrotask() {
  return wait(0);
}

// A real outside press always begins with a `pointerdown`; the swipe-open guard relies on that
// fresh press to distinguish a deliberate dismissal from the `click` synthesized by the gesture's
// own `pointerup`.
function pressOutside(target: Element = document.body) {
  fireEvent.pointerDown(target, { button: 0, buttons: 1, pointerType: 'mouse' });
  fireEvent.pointerUp(target, { button: 0, buttons: 0, pointerType: 'mouse' });
  fireEvent.click(target);
}

// A real touch tap dispatches `pointerdown` alongside `touchstart`/`touchend`.
function pressOutsideTouch(target: Element = document.body) {
  const touch = createTouch(target, { clientX: 0, clientY: 0 });
  fireEvent.pointerDown(target, { button: 0, buttons: 1, pointerId: 1, pointerType: 'touch' });
  fireEvent.touchStart(target, { touches: [touch] });
  fireEvent.touchEnd(target, { changedTouches: [touch], touches: [] });
  fireEvent.pointerUp(target, { button: 0, buttons: 0, pointerId: 1, pointerType: 'touch' });
  fireEvent.click(target);
}

async function swipeUp(element: HTMLElement, startY: number, endY: number, options?: SwipeOptions) {
  return swipe(element, { x: 10, y: startY }, { x: 10, y: endY }, options);
}

async function swipeLeft(
  element: HTMLElement,
  startX: number,
  endX: number,
  options?: SwipeOptions,
) {
  return swipe(element, { x: startX, y: 10 }, { x: endX, y: 10 }, options);
}

function StoreProbe(props: { storeRef: { current: DialogStore<unknown> | null } }) {
  // eslint-disable-next-line solid/reactivity
  props.storeRef.current = useDialogRootContext();
  return null;
}

function setOffsetHeight(element: HTMLElement, value: number) {
  Object.defineProperty(element, 'offsetHeight', { configurable: true, value });
}

describe('<Drawer.SwipeArea />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Drawer.Root>
          <Drawer.SwipeArea
            data-testid="swipe-area"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'area open' : 'area closed')}
            style={{ color: 'red' }}
            render={(props, state) => (
              <section {...props} data-state-direction={state.swipeDirection} />
            )}
          />
        </Drawer.Root>
      ));
      const swipeArea = screen.getByTestId('swipe-area');
      expect(ref).toBe(swipeArea);
      expect(swipeArea.tagName).toBe('SECTION');
      expect(swipeArea).toHaveClass('area', 'closed');
      expect(swipeArea).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      // The internal style is merged with the user's.
      expect(swipeArea.style.touchAction).toBe('pan-x');
      expect(swipeArea).toHaveAttribute('data-state-direction', 'up');
      expect(swipeArea).toHaveAttribute('data-swipe-direction', 'up');
      expect(swipeArea).toHaveAttribute('aria-hidden', 'true');
      expect(swipeArea).toHaveAttribute('role', 'presentation');
    });

    it('renders a div by default', () => {
      render(() => (
        <Drawer.Root>
          <Drawer.SwipeArea data-testid="swipe-area" />
        </Drawer.Root>
      ));
      expect(screen.getByTestId('swipe-area')).toBeInstanceOf(window.HTMLDivElement);
    });
  });

  it('opens the drawer when swiped in the open direction', async () => {
    render(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    expect(swipeArea).toHaveAttribute('data-closed', '');

    await swipeUp(swipeArea, 120, 40);

    expect(swipeArea).toHaveAttribute('data-open', '');
  });

  it('does not open when the swipe direction never locks to the open direction', async () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Drawer.Root onOpenChange={handleOpenChange}>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    await swipe(swipeArea, { x: 10, y: 120 }, { x: 70, y: 118 });

    expect(swipeArea).toHaveAttribute('data-closed', '');
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('prevents default pointer down for non-touch swipes', () => {
    render(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>
    ));

    const notCancelled = fireEvent.pointerDown(screen.getByTestId('swipe-area'), {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
    });

    expect(notCancelled).toBe(false);
  });

  it('does not open the drawer when disabled', async () => {
    render(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" disabled />
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    await swipeUp(swipeArea, 120, 40);

    expect(swipeArea).toHaveAttribute('data-closed', '');
  });

  it('respects custom swipeDirection', async () => {
    render(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" swipeDirection="left" />
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    await swipeLeft(swipeArea, 120, 40);

    expect(swipeArea).toHaveAttribute('data-open', '');
  });

  it('synchronizes overshoot styles across the popup, backdrop, and provider indent', async () => {
    render(() => (
      <Drawer.Provider>
        <Drawer.Indent data-testid="indent" />
        <Drawer.Root>
          <Drawer.SwipeArea data-testid="swipe-area" swipeDirection="left" />
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup
                data-testid="popup"
                ref={(element) => {
                  Object.defineProperties(element, {
                    offsetHeight: { configurable: true, value: 100 },
                    offsetWidth: { configurable: true, value: 100 },
                  });
                }}
              >
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Provider>
    ));

    const swipeArea = screen.getByTestId('swipe-area');
    const indent = screen.getByTestId('indent');

    await swipeLeft(swipeArea, 200, -50, {
      async beforeRelease({ nextTimeStamp }) {
        const popup = screen.getByTestId('popup');
        const backdrop = screen.getByTestId('backdrop');

        expect(
          Number.parseFloat(popup.style.getPropertyValue('--drawer-swipe-movement-x')),
        ).toBeCloseTo(-Math.sqrt(150));
        expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
        expect(popup.style.transition).toBe('none');
        expect(backdrop).toHaveAttribute('data-swiping', '');
        expect(backdrop.style.getPropertyValue('--drawer-height')).toBe('100px');
        expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('1');
        expect(indent.style.getPropertyValue('--drawer-height')).toBe('100px');

        firePointer.move(swipeArea, {
          buttons: 1,
          pointerId: 1,
          clientX: 200,
          clientY: 0,
          pointerType: 'mouse',
          timeStamp: nextTimeStamp(),
        });
        await flushMicrotasks();
        expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
        expect(indent.style.getPropertyValue('--drawer-height')).toBe('');

        firePointer.move(swipeArea, {
          buttons: 1,
          pointerId: 1,
          clientX: -50,
          clientY: 0,
          pointerType: 'mouse',
          timeStamp: nextTimeStamp(),
        });
        await flushMicrotasks();
      },
    });

    expect(screen.getByTestId('backdrop')).not.toHaveAttribute('data-swiping');
    expect(screen.getByTestId('backdrop').style.getPropertyValue('--drawer-swipe-progress')).toBe(
      '0',
    );
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('');
  });

  it('opens from the rendered transform distance in either horizontal direction', async () => {
    render(() => (
      <Drawer.Root swipeDirection="left">
        <Drawer.SwipeArea data-testid="swipe-area" swipeDirection="right" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup
              data-testid="popup"
              style={{ transform: 'matrix(1, 0, 0, 1, 60, 0)' }}
              ref={(element) => {
                Object.defineProperty(element, 'offsetWidth', {
                  configurable: true,
                  value: 100,
                });
              }}
            >
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    await swipe(
      screen.getByTestId('swipe-area'),
      { x: 0, y: 10 },
      { x: 40, y: 10 },
      {
        beforeRelease() {
          expect(
            Number.parseFloat(
              screen.getByTestId('popup').style.getPropertyValue('--drawer-swipe-movement-x'),
            ),
          ).toBeCloseTo(-20);
        },
      },
    );

    expect(screen.getByTestId('swipe-area')).toHaveAttribute('data-open', '');
  });

  it('omits frontmost height when an opening drawer has no measured height', async () => {
    render(() => (
      <Drawer.Provider>
        <Drawer.Indent data-testid="indent" />
        <Drawer.Root>
          <Drawer.SwipeArea data-testid="swipe-area" swipeDirection="left" />
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup
                ref={(element) => {
                  Object.defineProperties(element, {
                    offsetHeight: { configurable: true, value: 0 },
                    offsetWidth: { configurable: true, value: 100 },
                  });
                }}
              >
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Provider>
    ));

    await swipeLeft(screen.getByTestId('swipe-area'), 100, 40, {
      beforeRelease() {
        expect(screen.getByTestId('backdrop').style.getPropertyValue('--drawer-height')).toBe('');
        expect(screen.getByTestId('indent').style.getPropertyValue('--drawer-height')).toBe('');
      },
    });
  });

  it('does not apply or close swipe state when a controlled parent rejects opening', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <Drawer.Root open={false} onOpenChange={handleOpenChange}>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal keepMounted>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup" ref={(element) => setOffsetHeight(element, 100)}>
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    await swipeUp(screen.getByTestId('swipe-area'), 120, 110, {
      startTimeMs: 1000,
      timeStepMs: 1000,
    });

    expect(handleOpenChange).toHaveBeenCalledWith(true, expect.anything());
    expect(handleOpenChange).not.toHaveBeenCalledWith(false, expect.anything());
    expect(screen.getByTestId('popup')).not.toHaveAttribute('data-swiping');
    expect(screen.getByTestId('popup').style.getPropertyValue('--drawer-swipe-movement-y')).toBe(
      '0px',
    );
  });

  // Upstream also asserts the cleanup runs before React's passive effects flush; Solid has no
  // passive effect phase, so only the cancellation itself is checked.
  it('cancels an active opening gesture when the swipe area becomes disabled', async () => {
    let providerContext: DrawerProviderContext | undefined;
    const cleanupCalls: number[] = [];

    function ProviderContextCapture() {
      providerContext = useDrawerProviderContext();
      return null;
    }

    const { setProps } = renderWithProps(
      (props: { disabled: boolean }) => (
        <Drawer.Provider>
          <ProviderContextCapture />
          <Drawer.Root>
            <Drawer.SwipeArea
              data-testid="swipe-area"
              disabled={props.disabled}
              ref={(element) => setOffsetHeight(element, 100)}
            />
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup data-testid="popup" ref={(element) => setOffsetHeight(element, 100)}>
                  Drawer
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>
        </Drawer.Provider>
      ),
      { disabled: false },
    );
    const swipeArea = screen.getByTestId('swipe-area');

    fireEvent.pointerDown(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(swipeArea, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 99,
      pointerType: 'mouse',
    });
    await flushMicrotasks();
    fireEvent.pointerMove(swipeArea, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 60,
      pointerType: 'mouse',
    });
    await flushMicrotasks();
    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('data-swiping', '');

    const originalSetVisualState = providerContext!.visualStateStore.set;
    providerContext!.visualStateStore.set = (state) => {
      if (state.swipeProgress === 0) {
        cleanupCalls.push(0);
      }
      originalSetVisualState(state);
    };

    try {
      await setProps({ disabled: true });
      expect(cleanupCalls.length).toBeGreaterThan(0);
      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-swiping');
      expect(swipeArea).toHaveAttribute('data-disabled', '');

      pressOutside();

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
    } finally {
      providerContext!.visualStateStore.set = originalSetVisualState;
    }
  });

  it('keeps the drawer open when the release click follows a mid-gesture disable', async () => {
    const { setProps } = renderWithProps(
      (props: { disabled: boolean }) => (
        <Drawer.Root>
          <Drawer.SwipeArea data-testid="swipe-area" disabled={props.disabled} />
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ),
      { disabled: false },
    );
    const swipeArea = screen.getByTestId('swipe-area');

    fireEvent.pointerDown(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(swipeArea, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 99,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(swipeArea, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 40,
      pointerType: 'mouse',
    });
    await flushMicrotasks();
    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

    await setProps({ disabled: true });

    // The pointer is still down when `disabled` flips, so the gesture's eventual release
    // synthesizes a click with no fresh `pointerdown`. It must not dismiss the drawer the
    // gesture just opened.
    const releaseClick = new MouseEvent('click', { bubbles: true, detail: 1 });
    Object.defineProperty(releaseClick, 'pointerType', { value: 'mouse' });
    fireEvent(document.body, releaseClick);

    await act(async () => {
      await nextMacrotask();
    });

    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

    pressOutside();

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  it('does not prevent a non-cancelable pointer start', async () => {
    render(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>
    ));

    const event = new Event('pointerdown', { bubbles: true, cancelable: false });
    Object.defineProperties(event, {
      pointerType: { value: 'mouse' },
      pointerId: { value: 1 },
      button: { value: 0 },
      buttons: { value: 1 },
      clientX: { value: 0 },
      clientY: { value: 0 },
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    let dispatched = false;
    await act(async () => {
      dispatched = screen.getByTestId('swipe-area').dispatchEvent(event);
      await flushMicrotasks();
    });
    expect(dispatched).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    expect(preventDefaultSpy).not.toHaveBeenCalled();

    fireEvent.pointerCancel(screen.getByTestId('swipe-area'), {
      pointerType: 'mouse',
      pointerId: 1,
    });
    await flushMicrotasks();
  });

  it('ignores compatibility touch pointer gestures with real displacement', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <Drawer.Root onOpenChange={handleOpenChange}>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>
    ));
    const swipeArea = screen.getByTestId('swipe-area');

    await act(async () => {
      dispatchTouchPointerEvent(swipeArea, 'pointerdown', { clientX: 0, clientY: 120 });
      dispatchTouchPointerEvent(swipeArea, 'pointermove', { clientX: 0, clientY: 40 });
      dispatchTouchPointerEvent(swipeArea, 'pointerup', { clientX: 0, clientY: 40 });
      dispatchTouchPointerEvent(swipeArea, 'pointercancel', { clientX: 0, clientY: 40 });
      await flushMicrotasks();
    });
    expect(handleOpenChange).not.toHaveBeenCalled();

    fireEvent.pointerDown(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
    });
    fireEvent.pointerCancel(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    expect(swipeArea).toHaveAttribute('data-closed', '');
    expect(swipeArea).not.toHaveAttribute('data-swiping');
  });

  // Upstream mocks `useId` to return `undefined` (React 17's effect-based fallback); Solid ids are
  // available synchronously, so these cases cannot occur.
  it.skip('works before a generated swipe area id is available', () => {});
  it.skip('registers the swipe area once a generated id becomes available', () => {});

  it('registers the swipe area as a trigger with its generated id', () => {
    const storeRef: { current: DialogStore<unknown> | null } = { current: null };

    render(() => (
      <Drawer.Root>
        <StoreProbe storeRef={storeRef} />
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');
    expect(swipeArea).toHaveAttribute('id');
    expect(storeRef.current!.context.triggerElements.getById(swipeArea.id)).toBe(swipeArea);
  });

  it('follows a swipe area id change', async () => {
    const storeRef: { current: DialogStore<unknown> | null } = { current: null };

    const { setProps } = renderWithProps(
      (props: { id: string }) => (
        <Drawer.Root>
          <StoreProbe storeRef={storeRef} />
          <Drawer.SwipeArea data-testid="swipe-area" id={props.id} />
        </Drawer.Root>
      ),
      { id: 'first' },
    );
    await flushMicrotasks();

    const swipeArea = screen.getByTestId('swipe-area');
    expect(storeRef.current!.context.triggerElements.getById('first')).toBe(swipeArea);

    await setProps({ id: 'second' });

    expect(storeRef.current!.context.triggerElements.getById('first')).toBeUndefined();
    expect(storeRef.current!.context.triggerElements.getById('second')).toBe(swipeArea);
    expect(storeRef.current!.context.triggerElements.size).toBe(1);
  });

  it('opens the drawer when swiped with touch events', async () => {
    render(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    await swipeUp(swipeArea, 120, 40, { input: 'touch' });

    expect(swipeArea).toHaveAttribute('data-open', '');
    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');
  });

  it('applies data-swiping during an active swipe gesture', async () => {
    render(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    await swipeUp(swipeArea, 120, 40, {
      beforeRelease() {
        expect(swipeArea).toHaveAttribute('data-swiping', '');
      },
    });

    expect(swipeArea).not.toHaveAttribute('data-swiping');
  });

  it('re-enables outside press dismissal after opening by swipe', async () => {
    render(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    await swipeUp(swipeArea, 120, 40, { input: 'touch' });

    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

    await act(async () => {
      await nextMacrotask();
    });

    pressOutside();

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    expect(swipeArea).toHaveAttribute('data-closed', '');
  });

  it('re-enables outside press dismissal for a touch outside press after opening by swipe', async () => {
    render(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    await swipeUp(swipeArea, 120, 40, { input: 'touch' });

    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

    await act(async () => {
      await nextMacrotask();
    });

    pressOutsideTouch();

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    expect(swipeArea).toHaveAttribute('data-closed', '');
  });

  it.each([
    { input: 'pointer' as const, pointerType: 'mouse' as const },
    { input: 'pointer' as const, pointerType: 'pen' as const },
    { input: 'touch' as const, pointerType: 'touch' as const },
  ])(
    'does not dismiss from the $pointerType/$input click synthesized by the swipe-open release',
    async ({ input, pointerType }) => {
      render(() => (
        <Drawer.Root>
          <Drawer.SwipeArea data-testid="swipe-area" />
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const swipeArea = screen.getByTestId('swipe-area');

      await swipeUp(swipeArea, 120, 40, { input, pointerType });

      expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

      await act(async () => {
        await nextMacrotask();
      });

      // Trailing synthesized click with no preceding fresh pointerdown.
      const releaseClick = new MouseEvent('click', { bubbles: true, detail: 1 });
      Object.defineProperty(releaseClick, 'pointerType', { value: pointerType });
      fireEvent(document.body, releaseClick);

      await act(async () => {
        await nextMacrotask();
      });

      expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');
    },
  );

  it('allows a later pointerless virtual click to dismiss when the release has no click', async () => {
    render(() => (
      <>
        <button type="button">Outside</button>
        <Drawer.Root modal={false}>
          <Drawer.SwipeArea data-testid="swipe-area" />
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup" initialFocus={false}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </>
    ));

    await swipeUp(screen.getByTestId('swipe-area'), 120, 40, { input: 'touch' });
    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

    eventUtilsMockState.forceVirtualClick = true;
    try {
      const virtualClick = new MouseEvent('click', { bubbles: true, detail: 1 });
      Object.defineProperty(virtualClick, 'pointerType', { value: '' });
      fireEvent(screen.getByRole('button', { name: 'Outside' }), virtualClick);
    } finally {
      eventUtilsMockState.forceVirtualClick = false;
    }

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  async function startInterruptedSwipe(swipeArea: HTMLElement) {
    fireEvent.pointerDown(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    fireEvent.pointerMove(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 119,
      buttons: 1,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    fireEvent.pointerMove(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 80,
      buttons: 1,
      pointerType: 'mouse',
    });
    await flushMicrotasks();
  }

  it('re-enables outside press dismissal after an interrupted swipe-open gesture', async () => {
    render(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    await startInterruptedSwipe(swipeArea);

    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');
    expect(swipeArea).toHaveAttribute('data-open', '');

    fireEvent.pointerMove(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 60,
      buttons: 2,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    await act(async () => {
      await nextMacrotask();
    });

    pressOutside();

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    expect(swipeArea).toHaveAttribute('data-closed', '');
  });

  it('re-enables outside press dismissal after a context menu interrupts swipe-open', async () => {
    render(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    await startInterruptedSwipe(swipeArea);

    expect(screen.getByTestId('popup')).toHaveAttribute('data-open', '');

    fireEvent.pointerMove(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 60,
      buttons: 2,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    fireEvent.contextMenu(swipeArea, {
      button: 2,
      clientX: 10,
      clientY: 60,
    });

    await act(async () => {
      await nextMacrotask();
    });

    pressOutside();

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  it('opens on a quick flick whose only move is already released (buttons: 0)', async () => {
    render(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    firePointer.down(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
      timeStamp: 1,
    });
    await flushMicrotasks();

    firePointer.move(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 40,
      buttons: 0,
      pointerType: 'mouse',
      timeStamp: 16,
    });
    await flushMicrotasks();

    // No trailing `pointerup` follows; the released move must finish the gesture by itself.
    expect(swipeArea).toHaveAttribute('data-open', '');
    expect(swipeArea).not.toHaveAttribute('data-swiping');

    pressOutside();

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  it('commits a released-move quick flick exactly once when a real pointerup trails it', async () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Drawer.Root onOpenChange={handleOpenChange}>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    firePointer.down(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
      timeStamp: 1,
    });
    await flushMicrotasks();

    firePointer.move(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 40,
      buttons: 0,
      pointerType: 'mouse',
      timeStamp: 16,
    });
    await flushMicrotasks();

    expect(swipeArea).toHaveAttribute('data-open', '');
    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    expect(handleOpenChange.mock.calls[0][0]).toBe(true);

    // The trailing `pointerup` a real browser still delivers must not re-run the release.
    firePointer.up(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 40,
      buttons: 0,
      pointerType: 'mouse',
      timeStamp: 32,
    });
    await flushMicrotasks();

    expect(swipeArea).toHaveAttribute('data-open', '');
    expect(swipeArea).not.toHaveAttribute('data-swiping');
    expect(handleOpenChange).toHaveBeenCalledTimes(1);
  });

  it('opens on a quick flick that lands its whole travel in a single touch move', async () => {
    render(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    fireEvent.touchStart(swipeArea, {
      bubbles: true,
      touches: [createTouch(swipeArea, { clientX: 10, clientY: 120 })],
    });
    await flushMicrotasks();

    fireEvent.touchMove(swipeArea, {
      bubbles: true,
      touches: [createTouch(swipeArea, { clientX: 10, clientY: 40 })],
    });
    await flushMicrotasks();

    fireEvent.touchEnd(swipeArea, {
      bubbles: true,
      changedTouches: [createTouch(swipeArea, { clientX: 10, clientY: 40 })],
    });
    await flushMicrotasks();

    expect(swipeArea).toHaveAttribute('data-open', '');
  });

  it('does not open on an in-place press-release without movement', async () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Drawer.Root onOpenChange={handleOpenChange}>
        <Drawer.SwipeArea data-testid="swipe-area" />
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    firePointer.down(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      pointerType: 'mouse',
      timeStamp: 1,
    });
    await flushMicrotasks();

    // Released in place: a `buttons: 0` move with no displacement must not open the drawer.
    firePointer.move(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      buttons: 0,
      pointerType: 'mouse',
      timeStamp: 16,
    });
    await flushMicrotasks();

    firePointer.up(swipeArea, {
      pointerId: 1,
      clientX: 10,
      clientY: 120,
      buttons: 0,
      pointerType: 'mouse',
      timeStamp: 32,
    });
    await flushMicrotasks();

    expect(swipeArea).toHaveAttribute('data-closed', '');
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('does not open a horizontal drawer on a stationary pointer move', () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Drawer.Root onOpenChange={handleOpenChange}>
        <Drawer.SwipeArea data-testid="swipe-area" swipeDirection="left" />
      </Drawer.Root>
    ));

    const swipeArea = screen.getByTestId('swipe-area');

    fireEvent.pointerDown(swipeArea, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 100,
      clientY: 10,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(swipeArea, {
      buttons: 1,
      pointerId: 1,
      clientX: 100,
      clientY: 10,
      pointerType: 'mouse',
    });

    expect(handleOpenChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(swipeArea, {
      pointerId: 1,
      clientX: 100,
      clientY: 10,
      pointerType: 'mouse',
    });

    expect(handleOpenChange).not.toHaveBeenCalled();
  });
});
