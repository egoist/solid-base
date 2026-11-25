import { describe, expect, it, vi } from 'vitest';
import { Show } from 'solid-js';
import { createEvent, fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Drawer } from '..';
import { act, flushMicrotasks, renderWithProps } from '../../dialog/test-utils';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import { useDrawerRootContext } from '../root/DrawerRootContext';

// Browser-only upstream (skipIf(isJSDOM)), not ported:
// - does not hijack cross-axis gestures from mixed-axis scroll containers
// - does not block vertical scrolling in right drawers when only vertical overflow exists
// - does not block vertical scrolling in left drawers when only vertical overflow exists
// - does not block horizontal scrolling in down drawers when only horizontal overflow exists
// - does not block horizontal scrolling in up drawers when only horizontal overflow exists

type PointerInit = Record<string, unknown> & { timeStamp?: number };

function firePointerEvent(
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  element: Element,
  init: PointerInit,
) {
  const { timeStamp, ...eventInit } = init;
  const event = createEvent[type](element, eventInit);
  if (timeStamp !== undefined) {
    Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  }
  return fireEvent(element, event);
}

const firePointer = {
  down: (element: Element, init: PointerInit) => firePointerEvent('pointerDown', element, init),
  move: (element: Element, init: PointerInit) => firePointerEvent('pointerMove', element, init),
  up: (element: Element, init: PointerInit) => firePointerEvent('pointerUp', element, init),
};

describe('<Drawer.Viewport /> gestures', () => {
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

  function setHeight(element: HTMLElement | null, value: number) {
    if (element) {
      Object.defineProperty(element, 'offsetHeight', { configurable: true, value });
    }
  }

  function createNativeTouchMove(target: EventTarget, point: { clientX: number; clientY: number }) {
    const touchMove = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(touchMove, 'touches', {
      value: [createTouch(target, point)],
      configurable: true,
    });
    return touchMove;
  }

  it.each(['HTML scroller', 'SVG scroller', 'axis ignore marker'] as const)(
    'expands a collapsed sheet when the first move from a %s leaves the popup',
    async (kind) => {
      const handleSnapPointChange = vi.fn();
      render(() => (
        <Drawer.Root
          defaultOpen
          swipeDirection="down"
          snapPoints={['100px', '200px']}
          defaultSnapPoint="100px"
          onSnapPointChange={handleSnapPointChange}
        >
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport data-testid="viewport" ref={(element) => setHeight(element, 400)}>
              <Drawer.Popup data-testid="popup" ref={(element) => setHeight(element, 200)}>
                <div
                  data-testid="scroll"
                  data-base-ui-swipe-ignore={kind === 'axis ignore marker' ? 'x' : undefined}
                  style={kind === 'axis ignore marker' ? undefined : { 'overflow-x': 'auto' }}
                >
                  {kind === 'SVG scroller' ? (
                    <svg>
                      <rect data-testid="target" width="120" height="40" />
                    </svg>
                  ) : (
                    <div data-testid="target">Swipe here</div>
                  )}
                </div>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const popup = screen.getByTestId('popup');
      const backdrop = screen.getByTestId('backdrop');
      const viewport = screen.getByTestId('viewport');
      const scroll = screen.getByTestId('scroll');
      const target = screen.getByTestId('target');
      if (kind !== 'axis ignore marker') {
        Object.defineProperty(scroll, 'scrollWidth', { value: 120, configurable: true });
        Object.defineProperty(scroll, 'clientWidth', { value: 40, configurable: true });
      }

      await waitFor(() =>
        expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('100px'),
      );

      const originalElementFromPoint = document.elementFromPoint;
      // The popup starts at y=300. Touch events keep their original target after leaving it.
      document.elementFromPoint = (_x, y) => (y >= 300 ? target : viewport);

      try {
        fireEvent.touchStart(target, {
          touches: [createTouch(target, { clientX: 100, clientY: 305 })],
        });
        expect(backdrop).not.toHaveAttribute('data-swiping');

        fireEvent.touchMove(target, {
          touches: [createTouch(target, { clientX: 100, clientY: 275 })],
        });
        expect(backdrop).toHaveAttribute('data-swiping');

        fireEvent.touchMove(target, {
          touches: [createTouch(target, { clientX: 100, clientY: 125 })],
        });
        expect(parseFloat(popup.style.getPropertyValue('--drawer-swipe-movement-y'))).toBeLessThan(
          0,
        );

        fireEvent.touchEnd(target, {
          changedTouches: [createTouch(target, { clientX: 100, clientY: 125 })],
        });
        await flushMicrotasks();

        expect(handleSnapPointChange).toHaveBeenCalledWith(
          '200px',
          expect.objectContaining({ reason: 'swipe' }),
        );

        // The next touch starts and stays outside; it must not inherit the previous eligibility.
        handleSnapPointChange.mockClear();
        fireEvent.touchStart(viewport, {
          touches: [createTouch(viewport, { clientX: 100, clientY: 275 })],
        });
        fireEvent.touchMove(viewport, {
          touches: [createTouch(viewport, { clientX: 100, clientY: 125 })],
        });
        expect(backdrop).not.toHaveAttribute('data-swiping');
        fireEvent.touchEnd(viewport, {
          changedTouches: [createTouch(viewport, { clientX: 100, clientY: 125 })],
        });
        await flushMicrotasks();
        expect(handleSnapPointChange).not.toHaveBeenCalled();
      } finally {
        document.elementFromPoint = originalElementFromPoint;
      }
    },
  );

  it('allows horizontal swipe dismiss from a vertical scroll container', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="right">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 20;

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 20,
          }),
        ],
      });

      fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 20,
            clientY: 20,
          }),
        ],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not prevent a sub-slop first touchmove over cross-axis scrollable content', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="right">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [createTouch(scroll, { clientX: 100, clientY: 100 })],
      });

      // Below the axis-attribution slop the gesture cannot be claimed yet: preventing the first
      // cancelable touchmove on iOS cancels native scrolling for the entire gesture.
      const firstMoveDispatched = fireEvent.touchMove(scroll, {
        touches: [createTouch(scroll, { clientX: 100, clientY: 97 })],
      });
      expect(firstMoveDispatched).toBe(true);

      // Past the slop on the cross axis, native vertical scrolling stays preserved.
      const secondMoveDispatched = fireEvent.touchMove(scroll, {
        touches: [createTouch(scroll, { clientX: 100, clientY: 60 })],
      });
      expect(secondMoveDispatched).toBe(true);

      fireEvent.touchEnd(scroll, {
        changedTouches: [createTouch(scroll, { clientX: 100, clientY: 60 })],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('claims the gesture once the drawer axis passes the slop over cross-axis scrollable content', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="right">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [createTouch(scroll, { clientX: 100, clientY: 100 })],
      });

      const ambiguousMoveDispatched = fireEvent.touchMove(scroll, {
        touches: [createTouch(scroll, { clientX: 103, clientY: 101 })],
      });
      expect(ambiguousMoveDispatched).toBe(true);

      const drawerAxisMoveDispatched = fireEvent.touchMove(scroll, {
        touches: [createTouch(scroll, { clientX: 112, clientY: 101 })],
      });
      expect(drawerAxisMoveDispatched).toBe(false);

      fireEvent.touchEnd(scroll, {
        changedTouches: [createTouch(scroll, { clientX: 112, clientY: 101 })],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('yields the gesture when the browser commits to a native cross-axis scroll', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="right">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [createTouch(scroll, { clientX: 100, clientY: 100 })],
      });

      fireEvent.touchMove(scroll, {
        touches: [createTouch(scroll, { clientX: 100, clientY: 97 })],
      });

      // A non-cancelable touchmove (still below the slop) means the browser committed the
      // gesture to a native scroll.
      const nonCancelableMove = new Event('touchmove', { bubbles: true, cancelable: false });
      Object.defineProperty(nonCancelableMove, 'touches', {
        value: [createTouch(scroll, { clientX: 100, clientY: 96 })],
        configurable: true,
      });
      scroll.dispatchEvent(nonCancelableMove);

      // Even a decisive drawer-axis move afterwards must not be claimed.
      const drawerAxisMoveDispatched = fireEvent.touchMove(scroll, {
        touches: [createTouch(scroll, { clientX: 140, clientY: 96 })],
      });
      expect(drawerAxisMoveDispatched).toBe(true);

      fireEvent.touchEnd(scroll, {
        changedTouches: [createTouch(scroll, { clientX: 140, clientY: 96 })],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('keeps tracking the finger when a claimed drag returns inside the slop', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="right">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [createTouch(scroll, { clientX: 100, clientY: 100 })],
      });

      fireEvent.touchMove(scroll, {
        touches: [createTouch(scroll, { clientX: 120, clientY: 100 })],
      });
      fireEvent.touchMove(scroll, {
        touches: [createTouch(scroll, { clientX: 150, clientY: 100 })],
      });

      expect(popup.style.getPropertyValue('--drawer-swipe-movement-x')).toBe('30px');

      // The slop is measured from the touch origin, so a claimed drag that travels back inside it
      // must not be re-arbitrated: the popup has to keep following the finger.
      const inSlopMoveDispatched = fireEvent.touchMove(scroll, {
        touches: [createTouch(scroll, { clientX: 103, clientY: 100 })],
      });
      expect(inSlopMoveDispatched).toBe(false);
      expect(
        Number.parseFloat(popup.style.getPropertyValue('--drawer-swipe-movement-x')),
      ).toBeLessThan(0);

      fireEvent.touchEnd(scroll, {
        changedTouches: [createTouch(scroll, { clientX: 103, clientY: 100 })],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('keeps driving a claimed drag through a non-cancelable touchmove', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="right">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div data-testid="scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
                <div style={{ height: '120px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [createTouch(scroll, { clientX: 100, clientY: 100 })],
      });

      fireEvent.touchMove(scroll, {
        touches: [createTouch(scroll, { clientX: 150, clientY: 100 })],
      });
      fireEvent.touchMove(scroll, {
        touches: [createTouch(scroll, { clientX: 200, clientY: 100 })],
      });

      expect(popup.style.getPropertyValue('--drawer-swipe-movement-x')).toBe('50px');

      // Once the drawer axis owns the gesture, a non-cancelable move no longer means the browser
      // took it for a native scroll, so the drag must not be abandoned.
      const nonCancelableMove = new Event('touchmove', { bubbles: true, cancelable: false });
      Object.defineProperty(nonCancelableMove, 'touches', {
        value: [createTouch(scroll, { clientX: 250, clientY: 100 })],
        configurable: true,
      });
      await act(async () => {
        scroll.dispatchEvent(nonCancelableMove);
      });

      expect(popup.style.getPropertyValue('--drawer-swipe-movement-x')).toBe('100px');

      const laterMoveDispatched = fireEvent.touchMove(scroll, {
        touches: [createTouch(scroll, { clientX: 300, clientY: 100 })],
      });
      expect(laterMoveDispatched).toBe(false);
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-x')).toBe('150px');

      fireEvent.touchEnd(scroll, {
        changedTouches: [createTouch(scroll, { clientX: 300, clientY: 100 })],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not lock vertical swipe after minor cross-axis jitter in down drawers', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ 'overflow-x': 'auto', width: '40px' }}>
                <div style={{ width: '120px', height: '40px' }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollWidth', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientWidth', { value: 40, configurable: true });
    scroll.scrollLeft = 0;

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 4,
            clientY: 3,
          }),
        ],
      });

      fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 4,
            clientY: 28,
          }),
        ],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('toggles data-swiping on the backdrop while swiping', async () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 8,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');

      fireEvent.pointerUp(viewport, {
        pointerId: 1,
        clientX: 0,
        clientY: 8,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(backdrop).not.toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('cancels pointer drags and ignores compatibility touch pointer cancellation', async () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 20,
        pointerType: 'mouse',
      });
      expect(backdrop).toHaveAttribute('data-swiping', '');

      fireEvent.pointerCancel(viewport, {
        pointerId: 1,
        clientX: 0,
        clientY: 20,
        pointerType: 'mouse',
      });
      expect(backdrop).not.toHaveAttribute('data-swiping');

      fireEvent.pointerDown(viewport, { pointerId: 2, pointerType: 'touch' });
      fireEvent.pointerCancel(viewport, { pointerId: 2, pointerType: 'touch' });
      expect(backdrop).not.toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('ignores touchstart when there is no active touch', async () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup>Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    fireEvent.touchStart(screen.getByTestId('viewport'), { touches: [] });
    expect(screen.getByTestId('backdrop')).not.toHaveAttribute('data-swiping');
  });

  it('uses regular horizontal dismissal when snap points are configured', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <Drawer.Root
        open
        onOpenChange={handleOpenChange}
        snapPoints={['100px', '200px']}
        swipeDirection="left"
      >
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup
              data-testid="popup"
              ref={(element) => {
                if (element) {
                  Object.defineProperty(element, 'offsetWidth', {
                    configurable: true,
                    value: 200,
                  });
                }
              }}
            >
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 180,
        clientY: 10,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 179,
        clientY: 10,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 40,
        clientY: 10,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(viewport, {
        pointerId: 1,
        clientX: 40,
        clientY: 10,
        pointerType: 'mouse',
      });
      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it('does not dismiss from a fast swipe that was never attributed to the snap point axis', async () => {
    const handleOpenChange = vi.fn();
    const handleSnapPointChange = vi.fn();

    vi.useFakeTimers();
    try {
      // The taller point is declared first so the expected settle target is not simply the
      // first resolved snap point.
      render(() => (
        <Drawer.Root
          open
          onOpenChange={handleOpenChange}
          onSnapPointChange={handleSnapPointChange}
          snapPoints={['200px', '100px']}
          swipeDirection="down"
        >
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport" ref={(element) => setHeight(element, 400)}>
              <Drawer.Popup data-testid="popup" ref={(element) => setHeight(element, 300)}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');
      const originalElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => popup;

      try {
        // A mostly horizontal flick: cumulative |deltaX| stays above |deltaY| on every
        // move so no swipe direction is ever attributed, while the final samples carry
        // fast downward velocity from the finger arcing down at lift.
        firePointer.down(viewport, {
          button: 0,
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 10,
          pointerType: 'mouse',
          timeStamp: 1000,
        });
        firePointer.move(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 120,
          clientY: 12,
          pointerType: 'mouse',
          timeStamp: 1050,
        });
        firePointer.move(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 200,
          clientY: 20,
          pointerType: 'mouse',
          timeStamp: 1100,
        });
        firePointer.move(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 240,
          clientY: 55,
          pointerType: 'mouse',
          timeStamp: 1120,
        });
        firePointer.up(viewport, {
          pointerId: 1,
          clientX: 240,
          clientY: 55,
          pointerType: 'mouse',
          timeStamp: 1130,
        });
        await flushMicrotasks();
      } finally {
        document.elementFromPoint = originalElementFromPoint;
      }

      expect(handleOpenChange).not.toHaveBeenCalled();
      // The release settles on the nearest snap point rather than dismissing.
      expect(handleSnapPointChange).not.toHaveBeenCalledWith(null, expect.anything());
      expect(handleSnapPointChange).toHaveBeenCalledWith('100px', expect.anything());
      expect(popup).not.toHaveAttribute('data-ending-style');
      expect(popup).not.toHaveAttribute('data-swipe-dismiss');
    } finally {
      vi.useRealTimers();
    }
  });

  it('navigates snap points from a drag that was never attributed to the swipe axis', async () => {
    const handleOpenChange = vi.fn();
    const handleSnapPointChange = vi.fn();

    render(() => (
      <Drawer.Root
        open
        onOpenChange={handleOpenChange}
        onSnapPointChange={handleSnapPointChange}
        snapPoints={['100px', '200px']}
        swipeDirection="down"
      >
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport" ref={(element) => setHeight(element, 400)}>
            <Drawer.Popup data-testid="popup" ref={(element) => setHeight(element, 300)}>
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      // A sustained diagonal drag: cumulative |deltaX| stays above |deltaY| on every
      // move so no direction is attributed, while the vertical component drags the
      // sheet 150px upward toward the taller snap point.
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 300,
        clientY: 300,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 280,
        clientY: 290,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 200,
        clientY: 220,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 140,
        clientY: 150,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(viewport, {
        pointerId: 1,
        clientX: 140,
        clientY: 150,
        pointerType: 'mouse',
      });
      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleSnapPointChange).toHaveBeenCalledWith('200px', expect.anything());
    expect(handleOpenChange).not.toHaveBeenCalled();
    expect(popup).not.toHaveAttribute('data-ending-style');
  });

  it('clears nested swipe state after an unattributed snap point gesture', async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open snapPoints={['100px', '200px']} swipeDirection="down">
                <Drawer.Portal>
                  <Drawer.Viewport
                    data-testid="child-viewport"
                    ref={(element) => setHeight(element, 400)}
                  >
                    <Drawer.Popup
                      data-testid="child-popup"
                      ref={(element) => setHeight(element, 300)}
                    >
                      Child
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const parentPopup = screen.getByTestId('parent-popup');
    const childPopup = screen.getByTestId('child-popup');
    const childViewport = screen.getByTestId('child-viewport');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => childPopup;

    try {
      fireEvent.pointerDown(childViewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 100,
        clientY: 10,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(childViewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 120,
        clientY: 12,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(childViewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 200,
        clientY: 30,
        pointerType: 'mouse',
      });
      await flushMicrotasks();

      expect(parentPopup).toHaveAttribute('data-nested-drawer-swiping', '');
      expect(parentPopup.style.getPropertyValue('--drawer-swipe-progress')).not.toBe('0');

      fireEvent.pointerUp(childViewport, {
        pointerId: 1,
        clientX: 200,
        clientY: 30,
        pointerType: 'mouse',
      });
      await flushMicrotasks();

      expect(parentPopup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
      expect(parentPopup).not.toHaveAttribute('data-nested-drawer-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('clears nested swipe state after an attributed drag settles on a snap point', async () => {
    vi.useFakeTimers();
    try {
      render(() => (
        <Drawer.Root open swipeDirection="down">
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="parent-popup">
                <Drawer.Root open snapPoints={['100px', '200px']} swipeDirection="down">
                  <Drawer.Portal>
                    <Drawer.Viewport
                      data-testid="child-viewport"
                      ref={(element) => setHeight(element, 400)}
                    >
                      <Drawer.Popup
                        data-testid="child-popup"
                        ref={(element) => setHeight(element, 300)}
                      >
                        Child
                      </Drawer.Popup>
                    </Drawer.Viewport>
                  </Drawer.Portal>
                </Drawer.Root>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const parentPopup = screen.getByTestId('parent-popup');
      const childPopup = screen.getByTestId('child-popup');
      const childViewport = screen.getByTestId('child-viewport');
      const originalElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => childPopup;

      try {
        // A straight-down drag, so the swipe direction is attributed, ending in a
        // slight upward reversal: the reversal flips the sampled release velocity
        // against the drag so the release resolves through the slow fallback velocity
        // and settles back on the snap point in both test environments.
        firePointer.down(childViewport, {
          button: 0,
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 10,
          pointerType: 'mouse',
          timeStamp: 1000,
        });
        firePointer.move(childViewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 24,
          pointerType: 'mouse',
          timeStamp: 1050,
        });
        firePointer.move(childViewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 48,
          pointerType: 'mouse',
          timeStamp: 1150,
        });
        await flushMicrotasks();

        expect(parentPopup).toHaveAttribute('data-nested-drawer-swiping', '');
        expect(parentPopup.style.getPropertyValue('--drawer-swipe-progress')).not.toBe('0');

        firePointer.move(childViewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 44,
          pointerType: 'mouse',
          timeStamp: 1250,
        });
        firePointer.up(childViewport, {
          pointerId: 1,
          clientX: 100,
          clientY: 44,
          pointerType: 'mouse',
          timeStamp: 1600,
        });
        await flushMicrotasks();

        expect(childPopup).not.toHaveAttribute('data-ending-style');
        expect(childPopup).not.toHaveAttribute('data-swipe-dismiss');
        expect(parentPopup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
        expect(parentPopup).not.toHaveAttribute('data-nested-drawer-swiping');
      } finally {
        document.elementFromPoint = originalElementFromPoint;
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not dismiss from an unattributed fast swipe with snapToSequentialPoints', async () => {
    const handleOpenChange = vi.fn();
    const handleSnapPointChange = vi.fn();

    vi.useFakeTimers();
    try {
      render(() => (
        <Drawer.Root
          open
          onOpenChange={handleOpenChange}
          onSnapPointChange={handleSnapPointChange}
          snapPoints={['100px', '200px']}
          snapToSequentialPoints
          swipeDirection="down"
        >
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport" ref={(element) => setHeight(element, 400)}>
              <Drawer.Popup data-testid="popup" ref={(element) => setHeight(element, 300)}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');
      const originalElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => popup;

      try {
        // Same mostly horizontal flick as the non-sequential test, released from the
        // most-collapsed snap point so the sequential branch has no adjacent point to
        // advance to and decides to close.
        firePointer.down(viewport, {
          button: 0,
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 10,
          pointerType: 'mouse',
          timeStamp: 1000,
        });
        firePointer.move(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 120,
          clientY: 12,
          pointerType: 'mouse',
          timeStamp: 1050,
        });
        firePointer.move(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 200,
          clientY: 20,
          pointerType: 'mouse',
          timeStamp: 1100,
        });
        firePointer.move(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 240,
          clientY: 55,
          pointerType: 'mouse',
          timeStamp: 1120,
        });
        firePointer.up(viewport, {
          pointerId: 1,
          clientX: 240,
          clientY: 55,
          pointerType: 'mouse',
          timeStamp: 1130,
        });
        await flushMicrotasks();
      } finally {
        document.elementFromPoint = originalElementFromPoint;
      }

      expect(handleOpenChange).not.toHaveBeenCalled();
      expect(handleSnapPointChange).not.toHaveBeenCalledWith(null, expect.anything());
      expect(handleSnapPointChange).toHaveBeenCalledWith('100px', expect.anything());
      expect(popup).not.toHaveAttribute('data-ending-style');
      expect(popup).not.toHaveAttribute('data-swipe-dismiss');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not start swipe dismissal when closing the snap point is canceled', async () => {
    const handleOpenChange = vi.fn();
    const handleSnapPointChange = vi.fn(
      (
        nextSnapPoint: Drawer.Root.SnapPoint | null,
        eventDetails: Drawer.Root.SnapPointChangeEventDetails,
      ) => {
        if (nextSnapPoint === null) {
          eventDetails.cancel();
        }
      },
    );

    vi.useFakeTimers();
    try {
      render(() => (
        <Drawer.Root
          open
          defaultSnapPoint="100px"
          onOpenChange={handleOpenChange}
          onSnapPointChange={handleSnapPointChange}
          snapPoints={['100px', '200px']}
          snapToSequentialPoints
          swipeDirection="down"
        >
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport" ref={(element) => setHeight(element, 400)}>
              <Drawer.Popup data-testid="popup" ref={(element) => setHeight(element, 300)}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');
      const releaseAttributes: string[] = [];
      const observer = new MutationObserver((records) => {
        records.forEach((record) => {
          if (record.attributeName) {
            releaseAttributes.push(record.attributeName);
          }
        });
      });
      observer.observe(popup, {
        attributeFilter: ['data-ending-style', 'data-swipe-dismiss'],
        attributes: true,
      });

      const originalElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => popup;

      try {
        firePointer.down(viewport, {
          button: 0,
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 10,
          pointerType: 'mouse',
          timeStamp: 1000,
        });
        firePointer.move(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 30,
          pointerType: 'mouse',
          timeStamp: 1050,
        });
        firePointer.move(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 80,
          pointerType: 'mouse',
          timeStamp: 1100,
        });
        firePointer.up(viewport, {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          pointerType: 'mouse',
          timeStamp: 1120,
        });
        await flushMicrotasks();
      } finally {
        document.elementFromPoint = originalElementFromPoint;
        observer.disconnect();
      }

      expect(handleSnapPointChange).toHaveBeenCalledWith(null, expect.anything());
      expect(handleOpenChange).not.toHaveBeenCalled();
      expect(releaseAttributes).toEqual([]);
      expect(popup).not.toHaveAttribute('data-ending-style');
      expect(popup).not.toHaveAttribute('data-swipe-dismiss');
    } finally {
      vi.useRealTimers();
    }
  });

  it('settles on the nearest snap point when an unattributed drag ends past the last snap point', async () => {
    const handleOpenChange = vi.fn();
    const handleSnapPointChange = vi.fn();

    vi.useFakeTimers();
    try {
      render(() => (
        <Drawer.Root
          open
          onOpenChange={handleOpenChange}
          onSnapPointChange={handleSnapPointChange}
          snapPoints={['200px', '100px']}
          defaultSnapPoint="100px"
          swipeDirection="down"
        >
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport" ref={(element) => setHeight(element, 400)}>
              <Drawer.Popup data-testid="popup" ref={(element) => setHeight(element, 300)}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');
      const originalElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => popup;

      try {
        // A slow diagonal drag that never attributes a direction and ends nearer the closed
        // position than to any snap point, so the release resolves through the close branch.
        firePointer.down(viewport, {
          button: 0,
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          pointerType: 'mouse',
          timeStamp: 1000,
        });
        firePointer.move(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 200,
          clientY: 120,
          pointerType: 'mouse',
          timeStamp: 1100,
        });
        firePointer.move(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 300,
          clientY: 170,
          pointerType: 'mouse',
          timeStamp: 1400,
        });
        firePointer.move(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 400,
          clientY: 190,
          pointerType: 'mouse',
          timeStamp: 1900,
        });
        firePointer.up(viewport, {
          pointerId: 1,
          clientX: 400,
          clientY: 190,
          pointerType: 'mouse',
          timeStamp: 1950,
        });
        await flushMicrotasks();
      } finally {
        document.elementFromPoint = originalElementFromPoint;
      }

      expect(handleOpenChange).not.toHaveBeenCalled();
      expect(handleSnapPointChange).not.toHaveBeenCalledWith(null, expect.anything());
      expect(handleSnapPointChange).toHaveBeenCalledWith('100px', expect.anything());
      expect(popup).not.toHaveAttribute('data-ending-style');
    } finally {
      vi.useRealTimers();
    }
  });

  it('settles on the nearest snap point when an unattributed drag ends past the last snap point with snapToSequentialPoints', async () => {
    const handleOpenChange = vi.fn();
    const handleSnapPointChange = vi.fn();

    vi.useFakeTimers();
    try {
      render(() => (
        <Drawer.Root
          open
          onOpenChange={handleOpenChange}
          onSnapPointChange={handleSnapPointChange}
          snapPoints={['200px', '100px']}
          defaultSnapPoint="100px"
          snapToSequentialPoints
          swipeDirection="down"
        >
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport" ref={(element) => setHeight(element, 400)}>
              <Drawer.Popup data-testid="popup" ref={(element) => setHeight(element, 300)}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');
      const originalElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => popup;

      try {
        // A slow diagonal drag that never attributes a direction and ends nearer the closed
        // position than to any snap point, so the release resolves through the close branch.
        firePointer.down(viewport, {
          button: 0,
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          pointerType: 'mouse',
          timeStamp: 1000,
        });
        firePointer.move(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 200,
          clientY: 120,
          pointerType: 'mouse',
          timeStamp: 1100,
        });
        firePointer.move(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 300,
          clientY: 170,
          pointerType: 'mouse',
          timeStamp: 1400,
        });
        firePointer.move(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 400,
          clientY: 190,
          pointerType: 'mouse',
          timeStamp: 1900,
        });
        firePointer.up(viewport, {
          pointerId: 1,
          clientX: 400,
          clientY: 190,
          pointerType: 'mouse',
          timeStamp: 1950,
        });
        await flushMicrotasks();
      } finally {
        document.elementFromPoint = originalElementFromPoint;
      }

      expect(handleOpenChange).not.toHaveBeenCalled();
      expect(handleSnapPointChange).not.toHaveBeenCalledWith(null, expect.anything());
      expect(handleSnapPointChange).toHaveBeenCalledWith('100px', expect.anything());
      expect(popup).not.toHaveAttribute('data-ending-style');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the resting snap point progress when a press never starts a swipe', async () => {
    render(() => (
      <Drawer.Root open snapPoints={['100px', '200px']} swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport" ref={(element) => setHeight(element, 400)}>
            <Drawer.Popup data-testid="popup" ref={(element) => setHeight(element, 300)}>
              <Drawer.Content data-testid="content">Drawer</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const backdrop = screen.getByTestId('backdrop');
    const content = screen.getByTestId('content');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => content;

    expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('1');

    try {
      // A press inside `Drawer.Content` never starts a swipe, but it still reaches the gesture
      // hook's release handler, which reports progress carrying the last drag deltas.
      fireEvent.pointerDown(content, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(content, {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        pointerType: 'mouse',
      });
      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('1');
  });

  it('does not resolve snap points before the popup has a measurable height', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <Drawer.Root
        open
        onOpenChange={handleOpenChange}
        snapPoints={['100px', '200px']}
        swipeDirection="down"
      >
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup
              data-testid="popup"
              ref={(element) => {
                if (element) {
                  Object.defineProperty(element, 'offsetHeight', {
                    configurable: true,
                    value: 0,
                  });
                }
              }}
            >
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 40,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(viewport, {
        pointerId: 1,
        clientX: 0,
        clientY: 40,
        pointerType: 'mouse',
      });
      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('falls back to regular dismissal when all snap points are invalid', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <Drawer.Root open onOpenChange={handleOpenChange} snapPoints={['50%']}>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup
              data-testid="popup"
              ref={(element) => {
                if (element) {
                  Object.defineProperty(element, 'offsetHeight', {
                    configurable: true,
                    value: 200,
                  });
                }
              }}
            >
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 140,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(viewport, {
        pointerId: 1,
        clientX: 0,
        clientY: 140,
        pointerType: 'mouse',
      });
      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it('ends swipe drag when the primary mouse button is released mid-gesture', async () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      fireEvent.pointerMove(viewport, {
        pointerId: 1,
        clientX: 0,
        clientY: 8,
        buttons: 1,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');

      // Simulate a right-click interruption where the primary button is no longer pressed.
      fireEvent.pointerMove(viewport, {
        pointerId: 1,
        clientX: 0,
        clientY: 12,
        buttons: 2,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(backdrop).not.toHaveAttribute('data-swiping');

      fireEvent.pointerMove(viewport, {
        pointerId: 1,
        clientX: 0,
        clientY: 30,
        buttons: 0,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(backdrop).not.toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('ignores swipe input until a popup is mounted', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <Drawer.Root open onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport" />
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => viewport;

    try {
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 100,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(viewport, {
        pointerId: 1,
        clientX: 0,
        clientY: 100,
        pointerType: 'mouse',
      });
      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('cleans up when the popup unmounts during an active swipe', async () => {
    const handleOpenChange = vi.fn();
    function TestCase(props: { showPopup: boolean }) {
      return (
        <Drawer.Root
          open
          onOpenChange={handleOpenChange}
          snapPoints={['100px', '200px']}
          swipeDirection="down"
        >
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport data-testid="viewport">
              <Show when={props.showPopup}>
                <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
              </Show>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      );
    }

    const { setProps } = renderWithProps((props: { showPopup: boolean }) => <TestCase {...props} />, {
      showPopup: true,
    });
    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 20,
        pointerType: 'mouse',
      });
      expect(screen.getByTestId('backdrop')).toHaveAttribute('data-swiping', '');

      await setProps({ showPopup: false });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 30,
        pointerType: 'mouse',
      });
      expect(screen.getByTestId('backdrop')).toHaveAttribute('data-swiping', '');

      fireEvent.pointerUp(viewport, {
        pointerId: 1,
        clientX: 0,
        clientY: 30,
        pointerType: 'mouse',
      });
      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(screen.getByTestId('backdrop')).not.toHaveAttribute('data-swiping');
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('does not start pointer swipes while a closed drawer remains mounted', async () => {
    const handleOpenChange = vi.fn();
    const originalElementFromPoint = document.elementFromPoint;

    try {
      render(() => (
        <Drawer.Root
          defaultOpen
          onOpenChange={(nextOpen, eventDetails) => {
            handleOpenChange(nextOpen);
            if (!nextOpen) {
              eventDetails.preventUnmountOnClose();
            }
          }}
        >
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup data-testid="popup">
                <Drawer.Close>Close</Drawer.Close>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');
      document.elementFromPoint = () => popup;

      await act(async () => {
        screen.getByRole('button', { name: 'Close' }).click();
      });
      await waitFor(() => {
        expect(popup).toHaveAttribute('data-closed', '');
      });
      handleOpenChange.mockClear();

      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 100,
        pointerType: 'mouse',
      });

      expect(screen.getByTestId('backdrop')).not.toHaveAttribute('data-swiping');
      expect(handleOpenChange).not.toHaveBeenCalled();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('clears a selection whose endpoints are popup elements', async () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const popup = screen.getByTestId('popup');
    const removeAllRanges = vi.fn();
    const selectionSpy = vi.spyOn(document, 'getSelection').mockReturnValue({
      anchorNode: popup,
      focusNode: popup,
      isCollapsed: false,
      removeAllRanges,
    } as unknown as Selection);
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(screen.getByTestId('viewport'), {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });
      expect(removeAllRanges).toHaveBeenCalledTimes(1);
    } finally {
      selectionSpy.mockRestore();
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('preserves an expanded touch selection whose focus endpoint is in the popup', async () => {
    render(() => (
      <div>
        <span data-testid="outside">Outside</span>
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    ));

    const popup = screen.getByTestId('popup');
    const outside = screen.getByTestId('outside');
    const selectionSpy = vi.spyOn(document, 'getSelection').mockReturnValue({
      anchorNode: outside,
      focusNode: popup,
      isCollapsed: false,
      containsNode: () => false,
    } as unknown as Selection);
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.touchStart(popup, {
        touches: [createTouch(popup, { clientX: 0, clientY: 100 })],
      });
      fireEvent.touchMove(popup, {
        touches: [createTouch(popup, { clientX: 0, clientY: 140 })],
      });

      expect(screen.getByTestId('backdrop')).not.toHaveAttribute('data-swiping');
    } finally {
      selectionSpy.mockRestore();
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('falls back to the viewport when a touch event has no element target', async () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const popup = screen.getByTestId('popup');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;
    const touchStart = new Event('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(touchStart, 'touches', {
      configurable: true,
      value: [createTouch(popup, { clientX: 0, clientY: 100 })],
    });
    // Solid's event delegation walks `composedPath()` itself, so only the viewport's own handler
    // sees a path without an element target.
    const viewport = popup.parentElement;
    const realComposedPath = touchStart.composedPath.bind(touchStart);
    touchStart.composedPath = function composedPath(this: Event) {
      return this.currentTarget === viewport ? [window] : realComposedPath();
    };

    try {
      await act(async () => {
        popup.dispatchEvent(touchStart);
        await flushMicrotasks();
      });
      fireEvent.touchMove(popup, {
        touches: [createTouch(popup, { clientX: 0, clientY: 140 })],
      });
      expect(screen.getByTestId('backdrop')).toHaveAttribute('data-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('ignores compatibility touch pointer gestures with real displacement', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <Drawer.Root open onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;
    const pointerEvents = [
      ['pointerdown', 0, 1],
      ['pointermove', 1, 1],
      ['pointermove', 100, 1],
      ['pointerup', 100, 0],
      ['pointercancel', 100, 0],
    ] as const;

    try {
      await act(async () => {
        for (const [type, clientY, buttons] of pointerEvents) {
          const event = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperties(event, {
            pointerType: { value: 'touch' },
            pointerId: { value: 1 },
            button: { value: 0 },
            buttons: { value: buttons },
            clientX: { value: 0 },
            clientY: { value: clientY },
          });

          viewport.dispatchEvent(event);
        }
        await flushMicrotasks();
      });
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(screen.getByTestId('backdrop')).not.toHaveAttribute('data-swiping');
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('publishes and clears swipe progress through Drawer.Provider', async () => {
    render(() => (
      <Drawer.Provider>
        <Drawer.Indent data-testid="indent" />
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup
                data-testid="popup"
                ref={(element) => {
                  if (element) {
                    Object.defineProperty(element, 'offsetHeight', {
                      configurable: true,
                      value: 100,
                    });
                  }
                }}
              >
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Provider>
    ));

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const indent = screen.getByTestId('indent');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 40,
        pointerType: 'mouse',
      });
      await flushMicrotasks();
      expect(
        Number.parseFloat(indent.style.getPropertyValue('--drawer-swipe-progress')),
      ).toBeCloseTo(0.39);
      expect(indent.style.getPropertyValue('--drawer-height')).toBe('100px');

      fireEvent.pointerMove(viewport, {
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });
      expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
      expect(indent.style.getPropertyValue('--drawer-height')).toBe('');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  // The next four tests check, upstream, that the work happens in layout effects (before
  // descendant passive effects). Solid has no layout/passive split, so only the outcome is checked.
  it('publishes resting snap progress when the snap point changes', async () => {
    function TestCase(props: { snapPoint: string }) {
      return (
        <Drawer.Root open modal={false} snapPoints={['100px', '200px']} snapPoint={props.snapPoint}>
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport ref={(element) => setHeight(element, 200)}>
              <Drawer.Popup ref={(element) => setHeight(element, 200)}>Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      );
    }

    const { setProps } = renderWithProps((props: { snapPoint: string }) => <TestCase {...props} />, {
      snapPoint: '100px',
    });
    await flushMicrotasks();
    const backdrop = screen.getByTestId('backdrop');
    await waitFor(() => {
      expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('1');
    });

    await setProps({ snapPoint: '200px' });
    expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
  });

  it('clears kept-mounted swipe state on reopen', async () => {
    function TestCase(props: { open: boolean }) {
      return (
        <Drawer.Root open={props.open} modal={false}>
          <Drawer.Portal keepMounted>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      );
    }

    const { setProps } = renderWithProps((props: { open: boolean }) => <TestCase {...props} />, {
      open: false,
    });
    const popup = screen.getByTestId('popup');
    popup.style.setProperty('--drawer-swipe-movement-y', '50px');
    popup.setAttribute('data-swipe-dismiss', '');

    await setProps({ open: true });
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
    expect(popup).not.toHaveAttribute('data-swipe-dismiss');
  });

  it('clears nested progress when the child closes', async () => {
    function NestedProgressControl() {
      const drawer = useDrawerRootContext();

      return (
        <button onClick={() => drawer.onNestedSwipeProgressChange(0.5)}>Set nested progress</button>
      );
    }

    function TestCase(props: { childOpen: boolean }) {
      return (
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="parent-popup">
                <Drawer.Root open={props.childOpen} modal={false}>
                  <Drawer.Portal keepMounted>
                    <Drawer.Viewport>
                      <Drawer.Popup>Child drawer</Drawer.Popup>
                    </Drawer.Viewport>
                  </Drawer.Portal>
                  <NestedProgressControl />
                </Drawer.Root>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      );
    }

    const { setProps, user } = renderWithProps(
      (props: { childOpen: boolean }) => <TestCase {...props} />,
      { childOpen: true },
    );
    await flushMicrotasks();

    await user.click(screen.getByRole('button', { name: 'Set nested progress' }));
    const parentPopup = screen.getByTestId('parent-popup');
    expect(parentPopup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');

    await setProps({ childOpen: false });
    expect(parentPopup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
  });

  it('clears provider and backdrop swipe state on teardown', async () => {
    function ProviderStateControl() {
      const providerContext = useDrawerProviderContext();

      return (
        <button
          onClick={() => {
            providerContext?.visualStateStore.set({
              swipeProgress: 0.5,
              frontmostHeight: 100,
            });
          }}
        >
          Set provider state
        </button>
      );
    }

    function TestCase(props: { showViewport: boolean }) {
      return (
        <Drawer.Provider>
          <Drawer.Indent data-testid="indent" />
          <ProviderStateControl />
          <Drawer.Root open modal={false}>
            <Drawer.Portal>
              <Drawer.Backdrop data-testid="backdrop" />
              <Show when={props.showViewport}>
                <Drawer.Viewport>
                  <Drawer.Popup>Drawer</Drawer.Popup>
                </Drawer.Viewport>
              </Show>
            </Drawer.Portal>
          </Drawer.Root>
        </Drawer.Provider>
      );
    }

    const { setProps, user } = renderWithProps(
      (props: { showViewport: boolean }) => <TestCase {...props} />,
      { showViewport: true },
    );
    await flushMicrotasks();

    await user.click(screen.getByRole('button', { name: 'Set provider state' }));
    const indent = screen.getByTestId('indent');
    const backdrop = screen.getByTestId('backdrop');
    backdrop.setAttribute('data-swiping', '');
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('100px');

    await setProps({ showViewport: false });
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('');
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('leaves pinch-zoom touchmove to the browser', async () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const popup = screen.getByTestId('popup');
    fireEvent.touchStart(popup, {
      touches: [createTouch(popup, { clientX: 0, clientY: 100 })],
    });
    const touchMove = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(touchMove, 'touches', {
      configurable: true,
      value: [
        createTouch(popup, { clientX: 0, clientY: 80 }),
        createTouch(popup, { clientX: 20, clientY: 80 }),
      ],
    });

    await act(async () => {
      expect(popup.dispatchEvent(touchMove)).toBe(true);
      await flushMicrotasks();
    });
    expect(screen.getByTestId('backdrop')).not.toHaveAttribute('data-swiping');
  });

  it('prevents page scrolling for a non-overflowing touch scroll container', async () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ 'overflow-y': 'auto' }}>
                Content
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    Object.defineProperties(scroll, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 200, writable: true },
    });
    fireEvent.touchStart(scroll, {
      touches: [createTouch(scroll, { clientX: 0, clientY: 100 })],
    });
    Object.defineProperty(scroll, 'scrollHeight', { configurable: true, value: 100 });
    const touchMove = createNativeTouchMove(scroll, { clientX: 0, clientY: 80 });

    await act(async () => {
      expect(scroll.dispatchEvent(touchMove)).toBe(false);
      await flushMicrotasks();
    });
    expect(touchMove.defaultPrevented).toBe(true);

    const nonCancelableMove = new Event('touchmove', { bubbles: true, cancelable: false });
    Object.defineProperty(nonCancelableMove, 'touches', {
      configurable: true,
      value: [createTouch(scroll, { clientX: 0, clientY: 60 })],
    });
    await act(async () => {
      expect(scroll.dispatchEvent(nonCancelableMove)).toBe(true);
      await flushMicrotasks();
    });
  });

  it('keeps a claimed scroll-edge swipe moving through non-cancelable events', async () => {
    const handleParentTouchMove = vi.fn();
    render(() => (
      <div onTouchMove={handleParentTouchMove}>
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>
                <div data-testid="scroll" style={{ height: '100px', 'overflow-y': 'auto' }}>
                  <div style={{ height: '300px' }} />
                </div>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    ));

    const scroll = screen.getByTestId('scroll');
    Object.defineProperties(scroll, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 300 },
    });
    scroll.scrollTop = 0;
    fireEvent.touchStart(scroll, {
      touches: [createTouch(scroll, { clientX: 0, clientY: 100 })],
    });
    fireEvent.touchMove(scroll, {
      touches: [createTouch(scroll, { clientX: 0, clientY: 120 })],
    });
    handleParentTouchMove.mockClear();

    const touchMove = new Event('touchmove', { bubbles: true, cancelable: false });
    Object.defineProperty(touchMove, 'touches', {
      configurable: true,
      value: [createTouch(scroll, { clientX: 0, clientY: 130 })],
    });
    await act(async () => {
      expect(scroll.dispatchEvent(touchMove)).toBe(true);
      await flushMicrotasks();
    });

    expect(handleParentTouchMove).not.toHaveBeenCalled();

    const cancelableMove = fireEvent.touchMove(scroll, {
      touches: [createTouch(scroll, { clientX: 0, clientY: 140 })],
    });
    expect(cancelableMove).toBe(false);
  });

  it('does not claim a stationary touch in overflowing content', async () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ height: '100px', 'overflow-y': 'auto' }}>
                <div style={{ height: '300px' }} />
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const scroll = screen.getByTestId('scroll');
    Object.defineProperties(scroll, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 300 },
    });
    fireEvent.touchStart(scroll, {
      touches: [createTouch(scroll, { clientX: 0, clientY: 100 })],
    });
    const touchMove = createNativeTouchMove(scroll, { clientX: 0, clientY: 100 });

    await act(async () => {
      expect(scroll.dispatchEvent(touchMove)).toBe(true);
      await flushMicrotasks();
    });
    expect(touchMove.defaultPrevented).toBe(false);
  });
});
