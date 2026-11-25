/*
 * Port of upstream `utils/useSwipeDismiss.test.tsx`.
 *
 * Browser-only upstream (skipIf(isJSDOM)), not ported:
 * - starts a touch swipe when the page scroller is `body`
 * - keeps gating on a scrollable descendant of the other axis when `body` scrolls the page
 *
 * Upstream's StrictMode variant of "snapshots swipeThreshold for the active gesture" has no Solid
 * equivalent; the test runs once.
 */
import { describe, expect, it, vi } from 'vitest';
import { flush, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createEvent, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSwipeDismiss, type CreateSwipeDismissOptions } from './swipeDismiss';
import { flushMicrotasks, renderWithProps } from '../dialog/test-utils';

type BoxOptions = Partial<Omit<CreateSwipeDismissOptions, 'element'>>;

/**
 * A swipeable box. `options` is read lazily (pass getters for reactive values).
 */
function SwipeBox(props: {
  options?: BoxOptions;
  testId?: string;
  input?: 'pointer' | 'touch';
  style?: JSX.CSSProperties;
  children?: JSX.Element;
  onCreate?: (swipe: ReturnType<typeof createSwipeDismiss>) => void;
}) {
  let element: HTMLDivElement | undefined;
  const options = props.options ?? {};
  // Copy the options as descriptors so getters stay live.
  const swipeOptions = Object.defineProperties(
    {
      enabled: true,
      directions: ['down'],
      movementCssVars: { x: '--x', y: '--y' },
      element: () => element,
    } as CreateSwipeDismissOptions,
    Object.getOwnPropertyDescriptors(options),
  );
  const swipe = createSwipeDismiss(swipeOptions);
  props.onCreate?.(swipe);

  const handlers = () =>
    props.input === 'touch' ? swipe.getTouchProps() : swipe.getPointerProps();

  return (
    <div
      data-testid={props.testId ?? 'el'}
      ref={(el) => {
        element = el;
      }}
      style={{ ...swipe.getDragStyles(), ...props.style }}
      {...handlers()}
    >
      {props.children}
    </div>
  );
}

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

type PointerInit = PointerEventInit & { timeStamp: number; bubbles?: boolean };

function firePointerEvent(
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  element: Element,
  init: PointerInit,
) {
  const { timeStamp, ...eventInit } = init;
  if (!(timeStamp > 0)) {
    throw new Error(`firePointer: timeStamp must be greater than 0, received ${timeStamp}.`);
  }
  const event = createEvent[type](element, eventInit);
  // `timeStamp` is read-only and not part of `PointerEventInit`.
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  const result = fireEvent(element, event);
  flush();
  return result;
}

/**
 * Fires pointer events that honor the given `timeStamp`, so velocity tests describe a fixed
 * timeline.
 */
const firePointer = {
  down: (element: Element, init: PointerInit) => firePointerEvent('pointerDown', element, init),
  move: (element: Element, init: PointerInit) => firePointerEvent('pointerMove', element, init),
  up: (element: Element, init: PointerInit) => firePointerEvent('pointerUp', element, init),
};

function pointerDown(element: Element, init: PointerEventInit & { bubbles?: boolean }) {
  fireEvent.pointerDown(element, init);
  flush();
}

function pointerMove(element: Element, init: PointerEventInit & { bubbles?: boolean }) {
  fireEvent.pointerMove(element, init);
  flush();
}

function pointerUp(element: Element, init: PointerEventInit & { bubbles?: boolean }) {
  fireEvent.pointerUp(element, init);
  flush();
}

describe('createSwipeDismiss', () => {
  it('does not start swiping within a scrollable element when ignoreScrollableAncestors is true', async () => {
    const onSwipeStart = vi.fn();

    render(() => (
      <SwipeBox testId="root" options={{ ignoreScrollableAncestors: true, onSwipeStart }}>
        <div data-testid="scroll" style={{ 'overflow-y': 'auto', height: '100px' }}>
          <div style={{ height: '200px' }} />
        </div>
      </SwipeBox>
    ));

    const root = screen.getByTestId('root');
    const scroll = screen.getByTestId('scroll') as HTMLDivElement;

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    if (scroll.scrollHeight <= scroll.clientHeight) {
      Object.defineProperty(scroll, 'scrollHeight', { value: 200, configurable: true });
      Object.defineProperty(scroll, 'clientHeight', { value: 100, configurable: true });
    }

    try {
      pointerDown(scroll, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 100,
        bubbles: true,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      pointerMove(scroll, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY: 150,
        bubbles: true,
      });

      await flushMicrotasks();

      expect(onSwipeStart).not.toHaveBeenCalled();
      expect(root.style.getPropertyValue('--y')).toBe('0px');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not prevent touch scrolling during swipe interactions', async () => {
    render(() => <SwipeBox />);
    const element = screen.getByTestId('el');

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // First move establishes the baseline (iOS pointermove delay handling).
    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 0, clientY: 100, bubbles: true });
    await flushMicrotasks();

    // Move up (unsupported) should not block the default touch scroll behavior.
    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 0, clientY: 50, bubbles: true });
    await flushMicrotasks();

    const touchMoveBefore = new Event('touchmove', { bubbles: true, cancelable: true });
    element.dispatchEvent(touchMoveBefore);
    expect(touchMoveBefore.defaultPrevented).toBe(false);

    // Once a supported direction is detected, touchmove should still not be prevented.
    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 0, clientY: 150, bubbles: true });
    await flushMicrotasks();

    const touchMoveAfter = new Event('touchmove', { bubbles: true, cancelable: true });
    element.dispatchEvent(touchMoveAfter);
    expect(touchMoveAfter.defaultPrevented).toBe(false);
  });

  it('fires onProgress relative to the element size', async () => {
    const onProgress = vi.fn();
    render(() => <SwipeBox testId="progress" options={{ directions: ['right'], onProgress }} />);
    const element = screen.getByTestId('progress');
    Object.defineProperty(element, 'offsetWidth', { value: 200, configurable: true });

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 0, clientY: 0, bubbles: true });
    await flushMicrotasks();

    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 50, clientY: 0, bubbles: true });
    await flushMicrotasks();

    const progress = onProgress.mock.calls.at(-1)?.[0];
    expect(progress).toBeCloseTo(0.25, 2);
  });

  it('continues firing onProgress when swipe progress is clamped', async () => {
    const onProgress = vi.fn();
    render(() => <SwipeBox testId="progress" options={{ directions: ['right'], onProgress }} />);
    const element = screen.getByTestId('progress');
    Object.defineProperty(element, 'offsetWidth', { value: 200, configurable: true });

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // Baseline move.
    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 0, clientY: 0, bubbles: true });
    await flushMicrotasks();

    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 50, clientY: 0, bubbles: true });
    await flushMicrotasks();

    const callsAfterForward = onProgress.mock.calls.length;

    // Move past the starting point in the opposite direction; progress is clamped to 0.
    pointerMove(element, { pointerId: 1, buttons: 1, clientX: -10, clientY: 0, bubbles: true });
    await flushMicrotasks();

    const callsAfterReverse = onProgress.mock.calls.length;
    expect(callsAfterReverse).toBeGreaterThan(callsAfterForward);

    pointerMove(element, { pointerId: 1, buttons: 1, clientX: -20, clientY: 0, bubbles: true });
    await flushMicrotasks();

    expect(onProgress.mock.calls.length).toBeGreaterThan(callsAfterReverse);
    expect(onProgress.mock.calls.at(-1)?.[0]).toBe(0);
  });

  it('applies exponential damping for opposite-direction movement', async () => {
    render(() => <SwipeBox />);
    const element = screen.getByTestId('el');

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();
    expect(element.style.transition).toBe('none');

    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 0, clientY: 100, bubbles: true });
    await flushMicrotasks();

    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 0, clientY: 50, bubbles: true });
    await flushMicrotasks();

    expect(element.style.getPropertyValue('--y')).not.toBe('0px');
  });

  it('preserves inline transform and transition when resetting drag styles', async () => {
    let swipe!: ReturnType<typeof createSwipeDismiss>;

    render(() => (
      <>
        <button type="button" onClick={() => swipe.reset()}>
          Reset
        </button>
        <SwipeBox
          testId="styled"
          onCreate={(value) => {
            swipe = value;
          }}
          style={{ transform: 'scale(0.9)', transition: 'opacity 200ms ease' }}
        />
      </>
    ));
    const element = screen.getByTestId('styled');
    const initialTransform = element.style.transform;
    const initialTransition = element.style.transition;

    async function moveTo(clientY: number) {
      pointerMove(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY,
        bubbles: true,
        pointerType: 'mouse',
      });
      await flushMicrotasks();
    }

    expect(initialTransform).not.toBe('');
    expect(initialTransition).not.toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    flush();
    await flushMicrotasks();

    expect(element.style.transform).toBe(initialTransform);
    expect(element.style.transition).toBe(initialTransition);

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    await moveTo(0);
    await moveTo(12);
    await moveTo(16);

    pointerUp(element, { pointerId: 1, clientX: 0, clientY: 16, bubbles: true });
    await flushMicrotasks();

    expect(element.style.transform).toBe(initialTransform);
    expect(element.style.transition).toBe(initialTransition);
  });

  it('applies the drag transform imperatively while swiping', async () => {
    render(() => <SwipeBox />);
    const element = screen.getByTestId('el');

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // The first move only establishes the drag baseline.
    pointerMove(element, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    pointerMove(element, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 40,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    expect(element.style.transition).toBe('none');
    expect(element.style.transform).toMatch(/translate3d\(0px, ?40px, ?0(?:px)?\)/);
    expect(element.style.getPropertyValue('--y')).toBe('40px');
  });

  it('keeps the drag transform in drag styles computed before the swiping state flushes', async () => {
    let swipe!: ReturnType<typeof createSwipeDismiss>;

    render(() => (
      <SwipeBox
        onCreate={(value) => {
          swipe = value;
        }}
      />
    ));
    const element = screen.getByTestId('el');

    // Fire the gesture without flushing, so the `swiping` signal still reads `false`.
    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(element, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(element, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 40,
      bubbles: true,
      pointerType: 'mouse',
    });

    // The gesture is active: the transform was written imperatively.
    expect(element.style.transition).toBe('none');
    expect(untrack(swipe.swiping)).toBe(false);

    // Drag styles computed while the signal lags must still mirror the imperative state.
    const laggingStyles = untrack(swipe.getDragStyles) as Record<string, string | undefined>;
    expect(laggingStyles.transition).toBe('none');
    expect(laggingStyles.transform).toMatch(/translate3d\(0px, ?40px, ?0(?:px)?\)/);

    flush();
    await flushMicrotasks();
    expect(element.style.transform).toMatch(/translate3d\(0px, ?40px, ?0(?:px)?\)/);
  });

  it('respects custom swipeThreshold', async () => {
    const onDismiss = vi.fn();
    render(() => <SwipeBox options={{ swipeThreshold: 10, onDismiss }} />);
    const element = screen.getByTestId('el');

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // Baseline move.
    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 0, clientY: 0, bubbles: true });
    await flushMicrotasks();

    // Move beyond the custom 10px threshold.
    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 0, clientY: 20, bubbles: true });
    await flushMicrotasks();

    pointerUp(element, { pointerId: 1, clientX: 0, clientY: 20, bubbles: true });
    await flushMicrotasks();

    expect(onDismiss).toHaveBeenCalled();
  });

  it('snapshots swipeThreshold for the active gesture', async () => {
    const onDismiss = vi.fn();

    const { setProps } = renderWithProps(
      (props: { swipeThreshold: number }) => (
        <SwipeBox
          options={{
            get swipeThreshold() {
              return props.swipeThreshold;
            },
            onDismiss,
          }}
        />
      ),
      { swipeThreshold: 50 },
    );
    const element = screen.getByTestId('el');

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 0, clientY: 0, bubbles: true });

    await setProps({ swipeThreshold: 10 });

    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 0, clientY: 20, bubbles: true });
    pointerUp(element, { pointerId: 1, clientX: 0, clientY: 20, bubbles: true });

    expect(onDismiss).not.toHaveBeenCalled();

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 2,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    pointerMove(element, { pointerId: 2, buttons: 1, clientX: 0, clientY: 0, bubbles: true });
    pointerMove(element, { pointerId: 2, buttons: 1, clientX: 0, clientY: 20, bubbles: true });
    pointerUp(element, { pointerId: 2, clientX: 0, clientY: 20, bubbles: true });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('fires onSwipingChange on start and end', async () => {
    const onSwipingChange = vi.fn();
    render(() => <SwipeBox testId="swiping" options={{ onSwipingChange }} />);
    const element = screen.getByTestId('swiping');

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    pointerUp(element, { pointerId: 1, clientX: 0, clientY: 0, bubbles: true });
    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenCalledTimes(2);
    expect(onSwipingChange).toHaveBeenNthCalledWith(1, true);
    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
  });

  it('cancels pointer swipe when the primary mouse button is released without pointerup', async () => {
    const onDismiss = vi.fn();
    const onSwipingChange = vi.fn();
    render(() => <SwipeBox testId="pointer-cancel" options={{ onDismiss, onSwipingChange }} />);
    const element = screen.getByTestId('pointer-cancel');

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 12,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenCalledWith(true);
    expect(element.style.getPropertyValue('--y')).not.toBe('0px');

    pointerMove(element, {
      pointerId: 1,
      buttons: 0,
      clientX: 0,
      clientY: 16,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
    expect(element.style.getPropertyValue('--y')).toBe('0px');
    expect(onDismiss).not.toHaveBeenCalled();

    pointerMove(element, {
      pointerId: 1,
      buttons: 0,
      clientX: 0,
      clientY: 40,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    expect(element.style.getPropertyValue('--y')).toBe('0px');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('commits the swipe when the primary button is released past the threshold without pointerup', async () => {
    const onDismiss = vi.fn();
    const onCancel = vi.fn();
    render(() => <SwipeBox testId="flick-release" options={{ onDismiss, onCancel }} />);
    const element = screen.getByTestId('flick-release');

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // First move establishes the start position; the second provides the displacement.
    pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // A trailing `buttons: 0` pointermove must commit the gesture, not cancel it.
    pointerMove(element, {
      pointerId: 1,
      buttons: 0,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('uses the final buttons:0 release move to decide dismissal when it crosses the threshold', async () => {
    const onDismiss = vi.fn();
    const onCancel = vi.fn();
    render(() => <SwipeBox testId="release-move" options={{ onDismiss, onCancel }} />);
    const element = screen.getByTestId('release-move');

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // Last pressed move stays just BELOW the 40px threshold.
    pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 35,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // The trailing `buttons: 0` release move carries the threshold-crossing displacement.
    pointerMove(element, {
      pointerId: 1,
      buttons: 0,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('resets swiping when touch ends over a scrollable descendant', async () => {
    const onSwipingChange = vi.fn();
    render(() => (
      <SwipeBox testId="touch-root" input="touch" options={{ onSwipingChange }}>
        <div data-testid="touch-scroll" style={{ 'overflow-y': 'auto', 'max-height': '40px' }}>
          <div style={{ height: '120px' }} />
        </div>
      </SwipeBox>
    ));

    const root = screen.getByTestId('touch-root');
    const scroll = screen.getByTestId('touch-scroll');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });

    fireEvent.touchStart(root, { touches: [createTouch(root, { clientX: 0, clientY: 0 })] });
    flush();
    await flushMicrotasks();

    fireEvent.touchMove(root, { touches: [createTouch(root, { clientX: 0, clientY: 20 })] });
    flush();
    await flushMicrotasks();

    fireEvent.touchEnd(scroll, {
      changedTouches: [createTouch(scroll, { clientX: 0, clientY: 20 })],
    });
    flush();
    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenCalledTimes(2);
    expect(onSwipingChange).toHaveBeenNthCalledWith(1, true);
    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
    expect(root.style.getPropertyValue('--y')).toBe('0px');
  });

  it('allows onRelease to override dismissal', async () => {
    const onDismiss = vi.fn();
    const onRelease = vi.fn(() => false);
    render(() => (
      <SwipeBox testId="release" options={{ swipeThreshold: 10, onDismiss, onRelease }} />
    ));
    const element = screen.getByTestId('release');

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 0, clientY: 0, bubbles: true });
    await flushMicrotasks();

    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 0, clientY: 20, bubbles: true });
    await flushMicrotasks();

    pointerUp(element, { pointerId: 1, clientX: 0, clientY: 20, bubbles: true });
    await flushMicrotasks();

    expect(onRelease).toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  describe('release velocity', () => {
    function renderVelocityBox(directions: CreateSwipeDismissOptions['directions']) {
      const onRelease = vi.fn();
      render(() => <SwipeBox testId="velocity" options={{ directions, onRelease }} />);
      return { onRelease, element: screen.getByTestId('velocity') };
    }

    function down(element: Element, timeStamp: number, pointerId = 1) {
      firePointer.down(element, {
        button: 0,
        buttons: 1,
        pointerId,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        pointerType: 'mouse',
        timeStamp,
      });
    }

    function move(element: Element, clientX: number, clientY: number, timeStamp: number) {
      firePointer.move(element, {
        pointerId: 1,
        buttons: 1,
        clientX,
        clientY,
        bubbles: true,
        timeStamp,
      });
    }

    function up(
      element: Element,
      clientX: number,
      clientY: number,
      timeStamp: number,
      pointerId = 1,
    ) {
      firePointer.up(element, { pointerId, clientX, clientY, bubbles: true, timeStamp });
    }

    it('provides swipe velocity on release', async () => {
      const { onRelease, element } = renderVelocityBox(['right']);

      down(element, 1000);
      await flushMicrotasks();
      move(element, 0, 0, 1100);
      await flushMicrotasks();
      move(element, 50, 0, 1200);
      await flushMicrotasks();
      up(element, 50, 0, 1300);
      await flushMicrotasks();

      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.velocityX).toBeCloseTo(0.25, 2);
      expect(details?.velocityY).toBeCloseTo(0, 2);
    });

    it('provides release velocity from the latest swipe movement', async () => {
      const { onRelease, element } = renderVelocityBox(['right']);

      down(element, 1000);
      await flushMicrotasks();
      move(element, 0, 0, 1100);
      await flushMicrotasks();
      move(element, 50, 0, 1200);
      await flushMicrotasks();
      move(element, 70, 0, 1216);
      await flushMicrotasks();
      up(element, 70, 0, 1224);
      await flushMicrotasks();

      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.releaseVelocityX).toBeCloseTo(1.25, 2);
      expect(details?.releaseVelocityY).toBeCloseTo(0, 2);
    });

    it.each([
      { trailingTime: 1040, releaseTime: 1048, expectedVelocity: 2.5 },
      { trailingTime: 1040, releaseTime: 1113, expectedVelocity: 0 },
      { trailingTime: 1113, releaseTime: 1121, expectedVelocity: 0 },
    ])(
      'handles a stationary move at $trailingTime and release at $releaseTime',
      async ({ trailingTime, releaseTime, expectedVelocity }) => {
        const { onRelease, element } = renderVelocityBox(['down']);

        down(element, 1000);
        await flushMicrotasks();
        move(element, 0, 20, 1008);
        await flushMicrotasks();
        move(element, 0, 40, 1016);
        await flushMicrotasks();
        move(element, 0, 60, 1024);
        await flushMicrotasks();
        move(element, 0, 80, 1032);
        await flushMicrotasks();
        // Chrome on Android emits an effectively stationary sample right before `pointerup`.
        move(element, 0, 80.5, trailingTime);
        await flushMicrotasks();
        up(element, 0, 80.5, releaseTime);
        await flushMicrotasks();

        // Keep the last moving sample (20px / 8ms), unless it is older than 80ms.
        const details = onRelease.mock.calls[0]?.[0];
        expect(details?.releaseVelocityY).toBeCloseTo(expectedVelocity, 4);
        expect(details?.releaseVelocityX).toBeCloseTo(0, 2);
      },
    );

    it.each([
      {
        name: '60 Hz input',
        moves: [
          [1016, 14.4],
          [1032, 28.8],
          [1048, 43.2],
          [1064, 57.6],
        ],
        release: [1080, 57.6],
        expected: 0.9,
      },
      {
        name: '120 Hz input',
        moves: [
          [1008, 7.2],
          [1016, 14.4],
          [1024, 21.6],
          [1032, 28.8],
        ],
        release: [1040, 28.8],
        expected: 0.9,
      },
      {
        name: 'a slower final step',
        moves: [
          [1008, 10],
          [1016, 20],
          [1024, 30],
          [1032, 31],
        ],
        release: [1040, 31],
        expected: 0.125,
      },
      {
        name: 'a flick after a pause',
        moves: [
          [1008, 10],
          [1016, 20],
          [1216, 30],
          [1224, 40],
        ],
        release: [1232, 40],
        expected: 1.25,
      },
      {
        // 8px over 2ms is floored to 4ms.
        name: 'near-simultaneous samples',
        moves: [
          [1008, 10],
          [1010, 18],
        ],
        release: [1018, 18],
        expected: 2,
      },
    ])(
      'measures release velocity from the latest movement ($name)',
      async ({ moves, release, expected }) => {
        const { onRelease, element } = renderVelocityBox(['down']);

        down(element, 1000);
        await flushMicrotasks();

        for (const [timeStamp, clientY] of moves) {
          move(element, 0, clientY, timeStamp);
          // eslint-disable-next-line no-await-in-loop
          await flushMicrotasks();
        }

        up(element, 0, release[1], release[0]);
        await flushMicrotasks();

        const details = onRelease.mock.calls[0]?.[0];
        expect(details?.releaseVelocityY).toBeCloseTo(expected, 4);
      },
    );

    it('keeps release velocity when moves arrive sparsely', async () => {
      const { onRelease, element } = renderVelocityBox(['down']);

      down(element, 1000);
      await flushMicrotasks();
      move(element, 0, 20, 1060);
      await flushMicrotasks();
      move(element, 0, 200, 1120);
      await flushMicrotasks();
      move(element, 0, 200.5, 1128);
      await flushMicrotasks();
      up(element, 0, 200.5, 1136);
      await flushMicrotasks();

      // Keep the last moving sample: 180px over 60ms.
      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.releaseVelocityY).toBeCloseTo(3, 4);
    });

    it('measures release velocity from the first move rather than the press', async () => {
      const { onRelease, element } = renderVelocityBox(['down']);

      down(element, 1000);
      await flushMicrotasks();
      // The first move arrives 200ms after the press and re-anchors the drag origin.
      move(element, 0, 5, 1200);
      await flushMicrotasks();
      move(element, 0, 15, 1208);
      await flushMicrotasks();
      up(element, 0, 15, 1216);
      await flushMicrotasks();

      // 10px over 8ms. Measuring from the press would report 0.05.
      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.releaseVelocityY).toBeCloseTo(1.25, 4);
    });

    it('decays release velocity while the pointer stays pinned', async () => {
      const { onRelease, element } = renderVelocityBox(['down']);

      down(element, 1000);
      await flushMicrotasks();
      move(element, 0, 0, 1000);
      await flushMicrotasks();
      move(element, 0, 20, 1016);
      await flushMicrotasks();

      // An off-screen mouse keeps emitting moves at the pinned coordinates.
      for (const timeStamp of [1032, 1048, 1064]) {
        move(element, 0, 20, timeStamp);
        // eslint-disable-next-line no-await-in-loop
        await flushMicrotasks();
      }

      up(element, 0, 20, 1072);
      await flushMicrotasks();

      // Repeated stationary samples clear the velocity from the last movement.
      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.releaseVelocityY).toBe(0);
    });

    it('does not report a previous gesture velocity for a release without movement', async () => {
      const { onRelease, element } = renderVelocityBox(['down']);

      down(element, 1000);
      await flushMicrotasks();
      move(element, 0, 40, 1008);
      await flushMicrotasks();
      move(element, 0, 120, 1016);
      await flushMicrotasks();
      up(element, 0, 120, 1024);
      await flushMicrotasks();

      expect(onRelease.mock.calls[0]?.[0]?.releaseVelocityY).toBeGreaterThan(1);

      down(element, 5000, 2);
      await flushMicrotasks();
      up(element, 0, 0, 5016, 2);
      await flushMicrotasks();

      const secondRelease = onRelease.mock.calls[1]?.[0];
      expect(secondRelease?.releaseVelocityY).toBe(0);
    });

    it('clamps short swipe durations when computing velocity', async () => {
      const { onRelease, element } = renderVelocityBox(['right']);

      down(element, 1000);
      await flushMicrotasks();
      move(element, 0, 0, 1005);
      await flushMicrotasks();
      move(element, 30, 0, 1010);
      await flushMicrotasks();
      up(element, 30, 0, 1015);
      await flushMicrotasks();

      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.velocityX).toBeCloseTo(0.6, 2);
      expect(details?.velocityY).toBeCloseTo(0, 2);
    });
  });

  it('ignores pointer interactions that were default prevented', async () => {
    const onSwipeStart = vi.fn();

    render(() => (
      <SwipeBox testId="root" options={{ onSwipeStart }}>
        <div data-testid="child" onPointerDown={(event) => event.preventDefault()} />
      </SwipeBox>
    ));

    const root = screen.getByTestId('root');
    const child = screen.getByTestId('child');

    pointerDown(child, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    pointerMove(child, { pointerId: 1, buttons: 1, clientX: 0, clientY: 150, bubbles: true });
    await flushMicrotasks();

    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(root.style.getPropertyValue('--y')).toBe('0px');
  });

  it('does nothing while disabled', async () => {
    const onSwipeStart = vi.fn();
    render(() => <SwipeBox options={{ enabled: false, onSwipeStart }} />);
    const element = screen.getByTestId('el');

    pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    pointerMove(element, { pointerId: 1, buttons: 1, clientX: 0, clientY: 50, bubbles: true });
    await flushMicrotasks();

    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(element.style.getPropertyValue('--y')).toBe('0px');
  });
});
