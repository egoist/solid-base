import { createEffect, omit, onSettled } from 'solid-js';
import { isElement } from '@floating-ui/utils/dom';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { ownerDocument, ownerWindow } from '@egoist/solid-base-utils/owner';
import { createAnimationFrame } from '@egoist/solid-base-utils/animationFrame';
import { clamp } from '@egoist/solid-base-utils/clamp';
import { activeElement, contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { renderElement } from '../../internals/renderElement';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import type { SliderRootState } from '../root/SliderRoot';
import { isTouchLikePointerType } from '../../internals/pressAndHold';
import { getMidpoint } from '../utils/getMidpoint';
import { roundValueToStep } from '../utils/roundValueToStep';
import { validateMinimumDistance } from '../utils/validateMinimumDistance';
import { resolveThumbCollision } from '../utils/resolveThumbCollision';

const INTENTIONAL_DRAG_COUNT_THRESHOLD = 2;

interface Coords {
  x: number;
  y: number;
}

function getControlOffset(styles: CSSStyleDeclaration | null, vertical: boolean) {
  if (!styles) {
    return {
      start: 0,
      end: 0,
    };
  }

  function parseSize(value: string | null | undefined) {
    const parsed = value != null ? parseFloat(value) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const start = !vertical ? 'InlineStart' : 'Top';
  const end = !vertical ? 'InlineEnd' : 'Bottom';

  return {
    start:
      parseSize(styles[`border${start}Width` as keyof CSSStyleDeclaration] as string) +
      parseSize(styles[`padding${start}` as keyof CSSStyleDeclaration] as string),
    end:
      parseSize(styles[`border${end}Width` as keyof CSSStyleDeclaration] as string) +
      parseSize(styles[`padding${end}` as keyof CSSStyleDeclaration] as string),
  };
}

function getFingerCoords(event: TouchEvent | PointerEvent, touchId: number | null): Coords | null {
  // The event is TouchEvent
  if (touchId != null && (event as TouchEvent).changedTouches) {
    const touchEvent = event as TouchEvent;
    for (let i = 0; i < touchEvent.changedTouches.length; i += 1) {
      const touch = touchEvent.changedTouches[i];
      if (touch.identifier === touchId) {
        return {
          x: touch.clientX,
          y: touch.clientY,
        };
      }
    }

    return null;
  }

  // The event is PointerEvent
  return {
    x: (event as PointerEvent).clientX,
    y: (event as PointerEvent).clientY,
  };
}

/**
 * The clickable, interactive part of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Slider](https://base.egoist.dev/components/slider)
 */
export function SliderControl(componentProps: SliderControl.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const context = useSliderRootContext();
  const {
    lastChangeReasonRef,
    pressedThumbCenterOffsetRef,
    pressedThumbIndexRef,
    pressedValuesRef,
    thumbRefs,
  } = context;

  const direction = useDirection();

  let controlElement: HTMLElement | null = null;
  let styles: CSSStyleDeclaration | null = null;

  // A number that uniquely identifies the current finger in the touch session.
  let touchId: number | null = null;
  // The number of touch/pointermove events that have fired.
  let moveCount = 0;
  // The offset amount to each side of the control for inset sliders.
  // This value should be equal to the radius or half the width/height of the thumb.
  let insetThumbOffset = 0;
  let currentInteractionValue: number | number[] | null = null;
  // Whether `pointerdown` started the current gesture, so the `touchstart` that follows it
  // doesn't restart it.
  let pointerGesture = false;
  // The values applied during the current interaction, which the reactive `values` only reflect
  // after the next flush.
  let latestValues: readonly number[] = [];

  function getThumbInput(el: Element | null | undefined) {
    return el?.querySelector<HTMLInputElement>('input[type="range"]');
  }

  function updatePressedThumb(nextIndex: number) {
    pressedThumbIndexRef.current = nextIndex;
    if (!thumbRefs.current[nextIndex]) {
      pressedThumbCenterOffsetRef.current = null;
    }
  }

  function resetPressedThumb() {
    pressedThumbIndexRef.current = -1;
    pressedThumbCenterOffsetRef.current = null;
  }

  function isTargetDisabledThumb(target: EventTarget | null) {
    if (!isElement(target)) {
      return false;
    }

    return thumbRefs.current.some((thumbEl) => {
      if (!isElement(thumbEl) || !contains(thumbEl, target)) {
        return false;
      }

      return getThumbInput(thumbEl)?.disabled === true;
    });
  }

  // Event handlers read the context imperatively (at call time).
  function getFingerState(fingerCoords: Coords): FingerState | null {
    const control = controlElement;
    const thumbIndex = pressedThumbIndexRef.current;
    const values = context.values;

    if (!control || thumbIndex < 0 || thumbIndex >= values.length) {
      if (thumbIndex >= values.length) {
        currentInteractionValue = null;
      }
      return null;
    }

    const vertical = context.orientation === 'vertical';
    const { min, max, step } = context;
    const { width, height, bottom, left, right } = control.getBoundingClientRect();

    const controlOffset = getControlOffset(styles, vertical);
    const controlSize =
      (vertical ? height : width) - controlOffset.start - controlOffset.end - insetThumbOffset * 2;
    const thumbCenterOffset = pressedThumbCenterOffsetRef.current ?? 0;
    const fingerX = fingerCoords.x - thumbCenterOffset;
    const fingerY = fingerCoords.y - thumbCenterOffset;

    const valueSize = vertical
      ? bottom - fingerY - controlOffset.end
      : (direction() === 'rtl' ? right - fingerX : fingerX - left) - controlOffset.start;
    // the value at the finger origin scaled down to fit the range [0, 1]
    const valueRescaled = clamp((valueSize - insetThumbOffset) / controlSize, 0, 1);

    let newValue = (max - min) * valueRescaled + min;
    newValue = roundValueToStep(newValue, step, min);
    newValue = clamp(newValue, min, max);

    if (values.length <= 1) {
      return {
        value: context.isArrayValue ? [newValue] : newValue,
        thumbIndex,
        didSwap: false,
      };
    }

    return resolveThumbCollision(
      context.thumbCollisionBehavior,
      values,
      latestValues,
      pressedValuesRef.current,
      thumbIndex,
      newValue,
      min,
      max,
      step,
      context.minStepsBetweenValues,
    );
  }

  function startPressing(fingerCoords: Coords) {
    const values = context.values;
    const vertical = context.orientation === 'vertical';
    pressedValuesRef.current = values.length > 1 ? values.slice() : null;
    currentInteractionValue = null;
    latestValues = values;

    const pressedThumbIndex = pressedThumbIndexRef.current;
    let closestThumbIndex = pressedThumbIndex;

    if (pressedThumbIndex > -1 && pressedThumbIndex < values.length) {
      if (values[pressedThumbIndex] === context.max) {
        let candidateIndex = pressedThumbIndex;

        while (candidateIndex > 0 && values[candidateIndex - 1] === context.max) {
          candidateIndex -= 1;
        }

        closestThumbIndex = candidateIndex;
      }
    } else {
      // pressed on control
      const axis = !vertical ? 'x' : 'y';
      let minDistance: number | undefined;

      closestThumbIndex = -1;

      for (let i = 0; i < thumbRefs.current.length; i += 1) {
        const thumbEl = thumbRefs.current[i];
        if (isElement(thumbEl) && !getThumbInput(thumbEl)?.disabled) {
          const midpoint = getMidpoint(thumbEl, vertical);
          const distance = Math.abs(fingerCoords[axis] - midpoint);

          if (minDistance === undefined || distance <= minDistance) {
            closestThumbIndex = i;
            minDistance = distance;
          }
        }
      }
    }

    if (closestThumbIndex > -1 && closestThumbIndex !== pressedThumbIndex) {
      updatePressedThumb(closestThumbIndex);
    }

    if (context.inset) {
      const thumbEl = thumbRefs.current[closestThumbIndex];
      if (isElement(thumbEl)) {
        const thumbRect = thumbEl.getBoundingClientRect();
        const side = !vertical ? 'width' : 'height';
        insetThumbOffset = thumbRect[side] / 2;
      }
    }
  }

  function focusThumb(thumbIndex: number) {
    const input = getThumbInput(thumbRefs.current?.[thumbIndex]);
    if (!input) {
      return;
    }

    input.focus({
      preventScroll: true,
      // Prevent pointer-driven focus rings in browsers that support this option.
      // Supported in Chrome from 144+.
      focusVisible: false,
    } as FocusOptions);
  }

  function setValueFromPointer(
    finger: FingerState,
    reason: typeof REASONS.trackPress | typeof REASONS.drag,
    nativeEvent: TouchEvent | PointerEvent,
  ) {
    const applied = context.setValue(
      finger.value,
      createChangeEventDetails(reason, nativeEvent, undefined, {
        activeThumbIndex: finger.thumbIndex,
      }),
    );

    if (applied) {
      currentInteractionValue = finger.value;
      latestValues = Array.isArray(finger.value) ? finger.value : [finger.value];

      // Only track and focus the swapped thumb once the change is actually applied so a
      // canceled swap doesn't leak the new index into subsequent moves.
      if (finger.didSwap) {
        updatePressedThumb(finger.thumbIndex);
        focusThumb(finger.thumbIndex);
      }
    }

    return applied;
  }

  function handleTouchMove(nativeEvent: TouchEvent | PointerEvent) {
    const fingerCoords = getFingerCoords(nativeEvent, touchId);

    if (fingerCoords == null) {
      return;
    }

    moveCount += 1;

    // Cancel move in case some other element consumed a pointerup event and it was not fired.
    if (nativeEvent.type === 'pointermove' && (nativeEvent as PointerEvent).buttons === 0) {
      handleTouchEnd(nativeEvent);
      return;
    }

    const finger = getFingerState(fingerCoords);

    if (finger == null) {
      return;
    }

    if (validateMinimumDistance(finger.value, context.step, context.minStepsBetweenValues)) {
      if (!context.dragging && moveCount > INTENTIONAL_DRAG_COUNT_THRESHOLD) {
        context.setDragging(true);
      }

      setValueFromPointer(finger, REASONS.drag, nativeEvent);
    }
  }

  function handleTouchEnd(nativeEvent: TouchEvent | PointerEvent) {
    if (getFingerCoords(nativeEvent, touchId) == null) {
      return;
    }

    context.setActive(-1);
    context.setDragging(false);

    pressedThumbCenterOffsetRef.current = null;

    // If the value array shrank or grew mid-drag, the cached interaction value no longer
    // matches the current thumbs (the pressed index can still be in range), so dropping it
    // keeps a stale or malformed array from being committed on release.
    const interactionValue = currentInteractionValue;
    if (Array.isArray(interactionValue) && interactionValue.length !== context.values.length) {
      currentInteractionValue = null;
    }

    if (currentInteractionValue != null) {
      const commitReason = lastChangeReasonRef.current;
      context.onValueCommitted(
        currentInteractionValue,
        createGenericEventDetails(commitReason, nativeEvent),
      );
    }

    if ('pointerType' in nativeEvent && controlElement?.hasPointerCapture(nativeEvent.pointerId)) {
      controlElement?.releasePointerCapture(nativeEvent.pointerId);
    }

    pressedThumbIndexRef.current = -1;
    stopListening();
  }

  function handlePointerCancel(nativeEvent: PointerEvent) {
    // The browser cancels a touch pointer once it starts panning, but the touch listeners keep
    // tracking the finger until `touchend` or `touchcancel`.
    if (touchId != null) {
      return;
    }

    handleTouchEnd(nativeEvent);
  }

  function handleTouchStart(nativeEvent: TouchEvent) {
    // Only the `touchstart` right after `pointerdown` belongs to the pointer gesture, so consume
    // the flag here where it can't outlive a cancelled gesture.
    const startedByPointer = pointerGesture;
    pointerGesture = false;

    if (context.disabled) {
      return;
    }

    if (isTargetDisabledThumb(getTarget(nativeEvent))) {
      resetPressedThumb();
      return;
    }

    const touch = nativeEvent.changedTouches[0];
    if (touch == null) {
      return;
    }

    touchId = touch.identifier;

    // The pointer handlers already started this gesture. Keep its state and only add the touch
    // listeners, which continue tracking the finger if the browser cancels the pointer.
    if (!startedByPointer) {
      const fingerCoords = { x: touch.clientX, y: touch.clientY };
      startPressing(fingerCoords);

      const finger = getFingerState(fingerCoords);

      if (finger == null) {
        return;
      }

      focusThumb(finger.thumbIndex);
      setValueFromPointer(finger, REASONS.trackPress, nativeEvent);

      moveCount = 0;
    }

    const doc = ownerDocument(controlElement);
    doc.addEventListener('touchmove', handleTouchMove, { passive: true });
    doc.addEventListener('touchend', handleTouchEnd, { passive: true });
    doc.addEventListener('touchcancel', handleTouchEnd, { passive: true });
  }

  function stopListening() {
    const doc = ownerDocument(controlElement);
    doc.removeEventListener('pointermove', handleTouchMove);
    doc.removeEventListener('pointerup', handleTouchEnd);
    doc.removeEventListener('pointercancel', handlePointerCancel);
    doc.removeEventListener('touchmove', handleTouchMove);
    doc.removeEventListener('touchend', handleTouchEnd);
    doc.removeEventListener('touchcancel', handleTouchEnd);
    touchId = null;
    pressedValuesRef.current = null;
    currentInteractionValue = null;
    pointerGesture = false;
  }

  const focusFrame = createAnimationFrame();

  onSettled(() => {
    const control = controlElement;
    if (!control) {
      return () => stopListening();
    }

    const unsubscribeTouchStart = addEventListener(control, 'touchstart', handleTouchStart, {
      passive: true,
    });

    return () => {
      unsubscribeTouchStart();
      focusFrame.cancel();

      stopListening();
    };
  });

  // Like upstream's `useValueAsRef(values)`: re-sync whenever the committed values change.
  createEffect(
    () => context.values,
    (values) => {
      latestValues = values;
    },
  );

  createEffect(
    () => context.disabled,
    (disabled) => {
      if (disabled) {
        stopListening();
      }
    },
  );

  const controlProps: HTMLProps = {
    get 'data-base-ui-slider-control'() {
      return context.renderBeforeHydration ? '' : undefined;
    },
    onPointerDown(event: PointerEvent) {
      // Replace a flag left by a cancelled gesture that had no `touchstart` to consume it.
      pointerGesture = false;
      const control = controlElement;
      const target = getTarget(event);

      if (
        !control ||
        context.disabled ||
        event.defaultPrevented ||
        !isElement(target) ||
        // Only handle left clicks
        event.button !== 0
      ) {
        return;
      }

      if (isTargetDisabledThumb(target)) {
        resetPressedThumb();
        return;
      }

      const fingerCoords = { x: event.clientX, y: event.clientY };
      startPressing(fingerCoords);

      const finger = getFingerState(fingerCoords);

      if (finger == null) {
        return;
      }

      const pressedOnFocusedThumb = contains(
        thumbRefs.current[finger.thumbIndex],
        activeElement(ownerDocument(control)),
      );

      if (pressedOnFocusedThumb) {
        event.preventDefault();
      } else {
        focusFrame.request(() => {
          focusThumb(finger.thumbIndex);
        });
      }

      context.setDragging(true);

      const pressedOnAnyThumb = pressedThumbCenterOffsetRef.current != null;
      if (!pressedOnAnyThumb) {
        setValueFromPointer(finger, REASONS.trackPress, event);
      }

      if (event.pointerId) {
        control.setPointerCapture(event.pointerId);
      }

      moveCount = 0;
      // Touch and pen presses can be followed by a compatibility `touchstart` (Apple Pencil).
      pointerGesture = isTouchLikePointerType(event.pointerType);
      const doc = ownerDocument(control);
      doc.addEventListener('pointermove', handleTouchMove, { passive: true });
      doc.addEventListener('pointerup', handleTouchEnd, { once: true });
      doc.addEventListener('pointercancel', handlePointerCancel, { once: true });
    },
  };

  return renderElement('div', componentProps, {
    state: context.state,
    ref: (element: HTMLElement) => {
      controlElement = element;
      context.registerFieldControlRef(element);
      if (styles == null) {
        styles = ownerWindow(element).getComputedStyle(element);
      }
    },
    props: [controlProps, elementProps],
    stateAttributesMapping: sliderStateAttributesMapping,
  });
}

interface FingerState {
  value: number | number[];
  thumbIndex: number;
  didSwap: boolean;
}

export interface SliderControlState extends SliderRootState {}

export interface SliderControlProps extends BaseUIComponentProps<'div', SliderControlState> {}

export namespace SliderControl {
  export type State = SliderControlState;
  export type Props = SliderControlProps;
}
