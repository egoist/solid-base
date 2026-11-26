import { createEffect, createSignal, flush, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { mergeCleanups } from '@egoist/solid-base-utils/mergeCleanups';
import { ownerWindow, ownerDocument } from '@egoist/solid-base-utils/owner';
import { platform } from '@egoist/solid-base-utils/platform';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import { getTarget } from '@egoist/solid-base-utils/shadowDom';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import type { NumberFieldRootState } from '../root/NumberFieldRoot';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { NumberFieldScrubAreaContext } from './NumberFieldScrubAreaContext';
import { renderElement } from '../../internals/renderElement';
import { getViewportRect } from '../utils/getViewportRect';
import { createGenericEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

const SCRUB_AREA_STYLE: JSX.CSSProperties = {
  'touch-action': 'none',
  '-webkit-user-select': 'none',
  'user-select': 'none',
};

/**
 * An interactive area where the user can click and drag to change the field value.
 * Renders a `<span>` element.
 *
 * Documentation: [Solid Base Number Field](https://base.egoist.dev/components/number-field)
 */
export function NumberFieldScrubArea(componentProps: NumberFieldScrubArea.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'direction',
    'pixelSensitivity',
    'teleportDistance',
  );

  const direction = () => componentProps.direction ?? 'horizontal';
  const pixelSensitivity = () => componentProps.pixelSensitivity ?? 2;

  const {
    state,
    setIsScrubbing: setRootScrubbing,
    inputRef,
    focusInput,
    incrementValue,
    allowInputSyncRef,
    getStepAmount,
    onValueCommitted,
    lastChangedValueRef,
    valueRef,
  } = useNumberFieldRootContext();

  const disabled = () => state.disabled;
  const readOnly = () => state.readOnly;

  let scrubAreaElement: HTMLSpanElement | null = null;

  let isScrubbingNow = false;
  let didMove = false;
  let pointerDownTarget: EventTarget | null = null;
  let nativeClickReceived = false;
  const scrubAreaCursorRef = createRefObject<HTMLSpanElement | null>(null);
  let virtualCursorCoords = { x: 0, y: 0 };

  const exitPointerLockTimeout = createTimeout();
  const syntheticClickTimeout = createTimeout();

  const [isTouchInput, setIsTouchInput] = createSignal(false);
  const [isPointerLockDenied, setIsPointerLockDenied] = createSignal(false);
  const [isScrubbing, setIsScrubbing] = createSignal(false);

  function updateCursorTransform(virtualCursor: HTMLSpanElement, x: number, y: number) {
    // Invert the visual viewport scale so the cursor matches the OS cursor, which doesn't
    // scale with the content on pinch-zoom.
    const scale = ownerWindow(virtualCursor).visualViewport?.scale ?? 1;
    virtualCursor.style.transform = `translate3d(${x}px,${y}px,0) scale(${1 / scale})`;
  }

  function onScrub({ movementX, movementY }: PointerEvent) {
    const virtualCursor = scrubAreaCursorRef.current;

    if (!virtualCursor || !scrubAreaElement) {
      return;
    }

    const rect = getViewportRect(untrack(() => componentProps.teleportDistance), scrubAreaElement);

    const coords = virtualCursorCoords;

    // Wrap the cursor to the opposite edge when its center crosses a viewport bound.
    const wrap = (coord: number, halfSize: number, low: number, high: number) => {
      if (coord + halfSize < low) {
        return high - halfSize;
      }
      if (coord + halfSize > high) {
        return low - halfSize;
      }
      return coord;
    };

    const newCoords = {
      x: wrap(
        Math.round(coords.x + movementX),
        virtualCursor.offsetWidth / 2,
        rect.left,
        rect.right,
      ),
      y: wrap(
        Math.round(coords.y + movementY),
        virtualCursor.offsetHeight / 2,
        rect.top,
        rect.bottom,
      ),
    };

    virtualCursorCoords = newCoords;

    updateCursorTransform(virtualCursor, newCoords.x, newCoords.y);
  }

  function onScrubbingChange(scrubbingValue: boolean, { clientX, clientY }: PointerEvent) {
    setIsScrubbing(scrubbingValue);
    setRootScrubbing(scrubbingValue);
    // Render the cursor now so it can be positioned below (upstream's `flushSync`).
    flush();

    const virtualCursor = scrubAreaCursorRef.current;
    if (!virtualCursor || !scrubbingValue) {
      return;
    }

    const initialCoords = {
      x: clientX - virtualCursor.offsetWidth / 2,
      y: clientY - virtualCursor.offsetHeight / 2,
    };

    virtualCursorCoords = initialCoords;

    updateCursorTransform(virtualCursor, initialCoords.x, initialCoords.y);
  }

  createEffect(
    () => !disabled() && !readOnly() && isScrubbing(),
    (active) => {
      // Only listen while actively scrubbing; avoids unrelated pointerup events committing.
      if (!inputRef.current || !active) {
        return undefined;
      }

      let cumulativeDelta = 0;

      function handleScrubPointerUp(event: PointerEvent) {
        function handler() {
          try {
            ownerDocument(scrubAreaElement).exitPointerLock();
          } catch {
            // Ignore errors.
          } finally {
            isScrubbingNow = false;
            onScrubbingChange(false, event);
            onValueCommitted(
              lastChangedValueRef.current ?? valueRef.current,
              createGenericEventDetails(REASONS.scrub, event),
            );

            // Dispatch a click if no movement happened. While the pointer is locked, the
            // browser targets its click at the lock element instead of the scrub area.
            // Without a lock (WebKit, or a denied request) the native click still arrives,
            // and it is dispatched after pointerup in the same task, so wait one task and
            // only synthesize the click if the native one didn't reach the scrub area.
            const target = pointerDownTarget;
            const input = inputRef.current;
            if (!didMove && target != null && input) {
              const MouseEventConstructor = ownerWindow(input).MouseEvent;
              syntheticClickTimeout.start(0, () => {
                if (nativeClickReceived) {
                  return;
                }
                target.dispatchEvent(
                  new MouseEventConstructor('click', {
                    bubbles: true,
                    cancelable: true,
                  }),
                );
              });
            }

            didMove = false;
            pointerDownTarget = null;
          }
        }

        if (platform.engine.gecko) {
          // Firefox needs a small delay here when soft-clicking as the pointer
          // lock will not release otherwise.
          exitPointerLockTimeout.start(20, handler);
        } else {
          handler();
        }
      }

      function handleScrubPointerMove(event: PointerEvent) {
        if (!isScrubbingNow) {
          return;
        }

        // Prevent text selection.
        event.preventDefault();

        onScrub(event);

        const { movementX, movementY } = event;
        const isVertical = untrack(direction) === 'vertical';

        cumulativeDelta += isVertical ? movementY : movementX;

        if (Math.abs(cumulativeDelta) >= untrack(pixelSensitivity)) {
          cumulativeDelta = 0;
          didMove = true;
          const dValue = isVertical ? -movementY : movementX;
          const stepAmount = getStepAmount(event);
          const rawAmount = dValue * stepAmount;

          if (rawAmount !== 0) {
            allowInputSyncRef.current = true;
            // Apply the previous move's update first so `valueRef` is current.
            flush();
            incrementValue(Math.abs(rawAmount), {
              direction: rawAmount >= 0 ? 1 : -1,
              event,
              reason: REASONS.scrub,
            });
          }
        }
      }

      const win = ownerWindow(inputRef.current);
      const unsubscribe = mergeCleanups(
        addEventListener(win, 'pointerup', handleScrubPointerUp, true),
        addEventListener(win, 'pointermove', handleScrubPointerMove, true),
      );

      return () => {
        exitPointerLockTimeout.clear();
        unsubscribe();
      };
    },
  );

  // If the scrub area unmounts mid-scrub, release pointer lock and clear the root's scrubbing
  // state so it doesn't stay locked or stuck. (No commit: there's no pointer release here.)
  onCleanup(() => {
    if (isScrubbingNow) {
      isScrubbingNow = false;
      setRootScrubbing(false);
      try {
        ownerDocument(scrubAreaElement).exitPointerLock();
      } catch {
        // Ignore errors.
      }
    }
  });

  // Prevent scrolling using touch input when scrubbing (a non-passive native listener).
  createEffect(
    () => !disabled() && !readOnly(),
    (enabled) => {
      const element = scrubAreaElement;
      if (!element || !enabled) {
        return undefined;
      }

      function handleTouchStart(event: TouchEvent) {
        if (event.touches.length === 1) {
          event.preventDefault();
        }
      }

      return addEventListener(element, 'touchstart', handleTouchStart);
    },
  );

  const defaultProps: HTMLProps = {
    role: 'presentation',
    style: SCRUB_AREA_STYLE,
    async onPointerDown(event: PointerEvent) {
      if (event.defaultPrevented || readOnly() || event.button || disabled()) {
        return;
      }

      const isTouch = event.pointerType === 'touch';
      setIsTouchInput(isTouch);

      if (event.pointerType === 'mouse') {
        event.preventDefault();
        focusInput();
      }

      isScrubbingNow = true;
      didMove = false;
      nativeClickReceived = false;
      syntheticClickTimeout.clear();
      pointerDownTarget = getTarget(event);
      onScrubbingChange(true, event);

      // WebKit causes significant layout shift with the native message, so we can't use it.
      if (!isTouch && !platform.engine.webkit) {
        try {
          // Avoid non-deterministic errors in testing environments. This error sometimes
          // appears: "The root document of this element is not valid for pointer lock."
          await ownerDocument(scrubAreaElement).body.requestPointerLock();
          setIsPointerLockDenied(false);
        } catch (error) {
          setIsPointerLockDenied(true);
        } finally {
          // Re-emit the scrubbing state to reflect the resolved pointer-lock result on the cursor.
          if (isScrubbingNow) {
            onScrubbingChange(true, event);
          }
        }
      }
    },
  };

  const contextValue: NumberFieldScrubAreaContext = {
    isScrubbing,
    isTouchInput,
    isPointerLockDenied,
    scrubAreaCursorRef,
  };

  return (
    <NumberFieldScrubAreaContext value={contextValue}>
      {renderElement('span', componentProps, {
        ref: (element: HTMLSpanElement) => {
          scrubAreaElement = element;
          // Capture phase: record the native click before any handler can stop it.
          element.addEventListener(
            'click',
            () => {
              nativeClickReceived = true;
            },
            true,
          );
        },
        state,
        props: [defaultProps, elementProps],
        stateAttributesMapping,
      })}
    </NumberFieldScrubAreaContext>
  );
}

export interface NumberFieldScrubAreaState extends NumberFieldRootState {}

export interface NumberFieldScrubAreaProps extends BaseUIComponentProps<
  'span',
  NumberFieldScrubAreaState
> {
  /**
   * Cursor movement direction in the scrub area.
   * @default 'horizontal'
   */
  direction?: 'horizontal' | 'vertical' | undefined;
  /**
   * Determines how many pixels the cursor must move before the value changes.
   * A higher value will make scrubbing less sensitive.
   * @default 2
   */
  pixelSensitivity?: number | undefined;
  /**
   * If specified, determines the distance that the cursor may move from the center
   * of the scrub area before it will loop back around.
   */
  teleportDistance?: number | undefined;
}

export namespace NumberFieldScrubArea {
  export type State = NumberFieldScrubAreaState;
  export type Props = NumberFieldScrubAreaProps;
}
