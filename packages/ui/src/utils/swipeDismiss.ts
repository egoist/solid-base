import { createSignal, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { clamp } from '@egoist/solid-base-utils/clamp';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { closest, contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { findScrollableAncestor, findScrollableTouchTarget } from './scrollable';
import type { ScrollAxis } from './scrollable';
import { getElementAtPoint } from './getElementAtPoint';
import { getElementTransform } from './getElementTransform';

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

type SwipeDismissNativeEvent = PointerEvent | TouchEvent;

type SwipeProgressDetailsInternal = {
  deltaX: number;
  deltaY: number;
  direction: SwipeDirection | undefined;
};

const DEFAULT_SWIPE_THRESHOLD = 40;
const REVERSE_CANCEL_THRESHOLD = 10;
const MIN_VELOCITY_DURATION_MS = 50;
// Under one frame at 240 Hz, so it only damps near-simultaneous samples.
const MIN_RELEASE_VELOCITY_DURATION_MS = 4;
const MAX_RELEASE_VELOCITY_AGE_MS = 80;
const MIN_VELOCITY_SAMPLE_DISTANCE = 1;
const DEFAULT_IGNORE_SELECTOR = 'button,a,input,select,textarea,label,[role="button"]';

export function getDisplacement(direction: SwipeDirection, deltaX: number, deltaY: number) {
  switch (direction) {
    case 'up':
      return -deltaY;
    case 'down':
      return deltaY;
    case 'left':
      return -deltaX;
    case 'right':
      return deltaX;
    default:
      return 0;
  }
}

export function applyDirectionalDamping(
  deltaX: number,
  deltaY: number,
  directions: readonly SwipeDirection[],
) {
  const dampAxis = (delta: number, negative: SwipeDirection, positive: SwipeDirection) =>
    (delta < 0 && !directions.includes(negative)) || (delta > 0 && !directions.includes(positive))
      ? Math.sign(delta) * Math.abs(delta) ** 0.5
      : delta;

  return {
    x: dampAxis(deltaX, 'left', 'right'),
    y: dampAxis(deltaY, 'up', 'down'),
  };
}

export function updateSwipeCancelBaseline(
  baseline: { x: number; y: number },
  position: { x: number; y: number },
  movement: { x: number; y: number },
) {
  const clampAxis = (pos: number, base: number, move: number) =>
    (move < 0 && pos > base) || (move > 0 && pos < base) ? pos : base;

  return {
    x: clampAxis(position.x, baseline.x, movement.x),
    y: clampAxis(position.y, baseline.y, movement.y),
  };
}

export function shouldCancelReverseSwipe(
  directions: readonly SwipeDirection[],
  maxDisplacement: number,
  currentDisplacement: number,
) {
  return (
    !(directions.includes('left') && directions.includes('right')) &&
    !(directions.includes('up') && directions.includes('down')) &&
    maxDisplacement - currentDisplacement >= REVERSE_CANCEL_THRESHOLD
  );
}

export function getDismissDirection(
  directions: readonly SwipeDirection[],
  deltaX: number,
  deltaY: number,
  threshold: number,
): SwipeDirection | undefined {
  return directions.find((direction) => getDisplacement(direction, deltaX, deltaY) > threshold);
}

function getValidTimeStamp(timeStamp: number): number | null {
  return Number.isFinite(timeStamp) && timeStamp > 0 ? timeStamp : null;
}

function getDragTransform(dragOffset: { x: number; y: number }, scale: number): string {
  return `translate3d(${dragOffset.x}px,${dragOffset.y}px,0) scale(${scale})`;
}

function hasPrimaryMouseButton(buttons: number): boolean {
  return buttons % 2 === 1;
}

function isTouchEvent(event: SwipeDismissNativeEvent): event is TouchEvent {
  return 'touches' in event;
}

function safelyChangePointerCapture(
  element: HTMLElement,
  pointerId: number,
  method: 'setPointerCapture' | 'releasePointerCapture',
) {
  const pointerCaptureMethod = element[method];
  if (typeof pointerCaptureMethod !== 'function') {
    return;
  }

  try {
    pointerCaptureMethod.call(element, pointerId);
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFoundError') {
      return;
    }
    throw error;
  }
}

/**
 * Tracks a pointer/touch swipe gesture on an element and reports when it should dismiss it.
 *
 * The Solid counterpart of upstream's `useSwipeDismiss`. Options are read lazily (pass getters
 * for reactive values); callbacks are read when called. The returned handlers are stable: spread
 * `pointerProps`/`touchProps` (or `getPointerProps()`/`getTouchProps()`) on the swipe target, or
 * call them from your own handlers. Handlers receive native events.
 *
 * While swiping (and `trackDrag` is enabled), the element's `transform`, `transition` and
 * movement CSS variables are written imperatively; `getDragStyles()` returns the matching
 * declarative styles and is tracked (it updates when the swipe starts, ends or dismisses).
 */
export function createSwipeDismiss(options: CreateSwipeDismissOptions): CreateSwipeDismissReturnValue {
  const enabled = () => options.enabled;
  const directions = () => options.directions;
  const trackDrag = () => options.trackDrag ?? true;
  const ignoreSelectorWhenTouch = () => options.ignoreSelectorWhenTouch ?? true;
  const ignoreScrollableAncestors = () => options.ignoreScrollableAncestors ?? false;
  const getElement = () => options.element() ?? null;
  const primaryDirection = () => {
    const list = directions();
    return list.length === 1 ? list[0] : undefined;
  };
  const swipeThresholdDefault = () => {
    const swipeThreshold = options.swipeThreshold;
    return Math.max(
      0,
      typeof swipeThreshold === 'number' ? swipeThreshold : DEFAULT_SWIPE_THRESHOLD,
    );
  };
  const hasHorizontal = () => directions().includes('left') || directions().includes('right');
  const hasVertical = () => directions().includes('up') || directions().includes('down');
  // Consumers only pass directions on a single axis.
  const scrollAxis = (): ScrollAxis => (hasHorizontal() ? 'horizontal' : 'vertical');

  const [currentSwipeDirection, setCurrentSwipeDirection] = createSignal<
    SwipeDirection | undefined
  >(undefined, { ownedWrite: true });
  const [isSwiping, setIsSwiping] = createSignal(false, { ownedWrite: true });
  const [dragDismissed, setDragDismissedSignal] = createSignal(false, { ownedWrite: true });

  let dragDismissedValue = false;
  let dragStartPos = { x: 0, y: 0 };
  let dragOffset = { x: 0, y: 0 };
  let lastMovePos: { x: number; y: number } | null = null;
  let initialTransform = { x: 0, y: 0, scale: 1 };
  let intendedSwipeDirection: SwipeDirection | undefined;
  let maxSwipeDisplacement = 0;
  let cancelledSwipe = false;
  let swipeCancelBaseline = { x: 0, y: 0 };
  let isFirstPointerMove = false;
  let pendingSwipe = false;
  let pendingSwipeStartPos: { x: number; y: number } | null = null;
  let swipeFromScrollable = false;
  let sawPrimaryButtonsOnMove = false;
  let elementSize = { width: 0, height: 0 };
  let swipeProgress = 0;
  let swipeThreshold = DEFAULT_SWIPE_THRESHOLD;
  let swipeThresholdFunction:
    | ((details: { element: HTMLElement; direction: SwipeDirection }) => number)
    | null = null;
  let swipeStartTime: number | null = null;
  let lastDragSample: { x: number; y: number; time: number } | null = null;
  let hasStationarySample = false;
  let lastDragVelocity = { x: 0, y: 0 };
  let lastProgressDetails: SwipeProgressDetailsInternal | null = null;
  let isSwipingValue = false;
  let dragStyleSnapshot: [string, string] | null = null;

  function setDragDismissed(value: boolean) {
    dragDismissedValue = value;
    setDragDismissedSignal(value);
  }

  function setSwiping(nextSwiping: boolean) {
    if (isSwipingValue === nextSwiping) {
      return;
    }

    isSwipingValue = nextSwiping;
    setIsSwiping(nextSwiping);
    options.onSwipingChange?.(nextSwiping);
  }

  function resolveSwipeThreshold(direction: SwipeDirection | undefined) {
    if (!direction) {
      return;
    }

    const element = getElement();
    const thresholdFunction = swipeThresholdFunction;
    if (!element || !thresholdFunction) {
      return;
    }

    swipeThreshold = Math.max(0, thresholdFunction({ element, direction }));
  }

  function updateSwipeProgress(progress: number, details?: SwipeProgressDetailsInternal) {
    const nextProgress = Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;
    const progressChanged = nextProgress !== swipeProgress;
    let detailsChanged = false;

    if (details) {
      const lastDetails = lastProgressDetails;

      detailsChanged =
        !lastDetails ||
        lastDetails.deltaX !== details.deltaX ||
        lastDetails.deltaY !== details.deltaY ||
        lastDetails.direction !== details.direction;
    }

    if (!progressChanged && !detailsChanged) {
      return;
    }

    swipeProgress = nextProgress;
    if (details) {
      lastProgressDetails = details;
    } else if (progressChanged) {
      lastProgressDetails = null;
    }
    options.onProgress?.(nextProgress, details);
  }

  function syncDragStyles(swiping: boolean) {
    const element = getElement();
    if (!trackDrag() || !element) {
      if (!swiping) {
        dragStyleSnapshot = null;
      }
      return;
    }

    const style = element.style;
    const movementCssVars = options.movementCssVars;
    if (swiping) {
      if (!dragStyleSnapshot) {
        dragStyleSnapshot = [style.transition, style.transform];
      }

      style.transition = 'none';
    } else if (dragStyleSnapshot) {
      [style.transition, style.transform] = dragStyleSnapshot;
      dragStyleSnapshot = null;
    }

    const deltaX = dragOffset.x - initialTransform.x;
    const deltaY = dragOffset.y - initialTransform.y;

    if (swiping) {
      style.transform = getDragTransform(dragOffset, initialTransform.scale);
    }

    style.setProperty(movementCssVars.x, `${deltaX}px`);
    style.setProperty(movementCssVars.y, `${deltaY}px`);
  }

  function recordDragSample(offset: { x: number; y: number }, timeStamp: number | null) {
    if (timeStamp === null) {
      return;
    }

    const lastSample = lastDragSample;
    if (lastSample && timeStamp > lastSample.time) {
      // Some Android devices emit one effectively stationary move immediately before release.
      // Keep the last moving sample and its timestamp. Repeated stationary moves still clear
      // the velocity, and a release after a hold still expires the last moving sample.
      const stationary =
        Math.abs(offset.x - lastSample.x) < MIN_VELOCITY_SAMPLE_DISTANCE &&
        Math.abs(offset.y - lastSample.y) < MIN_VELOCITY_SAMPLE_DISTANCE;
      const skipSample = stationary && !hasStationarySample;
      hasStationarySample = stationary;
      if (skipSample) {
        return;
      }

      const durationMs = Math.max(timeStamp - lastSample.time, MIN_RELEASE_VELOCITY_DURATION_MS);
      lastDragVelocity = {
        x: (offset.x - lastSample.x) / durationMs,
        y: (offset.y - lastSample.y) / durationMs,
      };
    }

    lastDragSample = { x: offset.x, y: offset.y, time: timeStamp };
  }

  function reset() {
    setCurrentSwipeDirection(undefined);
    setSwiping(false);
    setDragDismissed(false);
    updateSwipeProgress(0);

    swipeThreshold = swipeThresholdDefault();
    swipeThresholdFunction = null;
    dragStartPos = { x: 0, y: 0 };
    dragOffset = { x: 0, y: 0 };
    initialTransform = { x: 0, y: 0, scale: 1 };
    intendedSwipeDirection = undefined;
    maxSwipeDisplacement = 0;
    cancelledSwipe = false;
    swipeCancelBaseline = { x: 0, y: 0 };
    isFirstPointerMove = false;
    lastMovePos = null;
    pendingSwipe = false;
    pendingSwipeStartPos = null;
    swipeFromScrollable = false;
    sawPrimaryButtonsOnMove = false;
    elementSize = { width: 0, height: 0 };
    swipeStartTime = null;
    lastDragSample = null;
    hasStationarySample = false;
    lastDragVelocity = { x: 0, y: 0 };
    lastProgressDetails = null;
    syncDragStyles(false);
  }

  function getPrimaryPointerPosition(event: SwipeDismissNativeEvent) {
    if (isTouchEvent(event)) {
      const touch = event.touches[0];
      return touch ? { x: touch.clientX, y: touch.clientY } : null;
    }

    return { x: event.clientX, y: event.clientY };
  }

  function isTouchLikeEvent(event: SwipeDismissNativeEvent) {
    if (isTouchEvent(event)) {
      return true;
    }
    return event.pointerType === 'touch';
  }

  function getTargetAtPoint(position: { x: number; y: number }, nativeEvent: Event) {
    const root = getElement()?.getRootNode();
    const elementAtPoint = getElementAtPoint(root, position.x, position.y);
    const target = elementAtPoint ?? getTarget(nativeEvent);
    return target as HTMLElement | null;
  }

  function findGestureScrollableTouchTarget(
    target: EventTarget | null,
    root: HTMLElement,
  ): HTMLElement | null {
    // The swiped element is positioned relative to the viewport, so the page scroller must not
    // gate the gesture (a reset like `html, body { height: 100%; overflow: auto }` makes `body`
    // a real scroll container). The drawer viewport's native touchmove handler already ignores it.
    const scrollTarget = findScrollableTouchTarget(target, root, scrollAxis());
    const doc = ownerDocument(scrollTarget);
    return scrollTarget === doc.body || scrollTarget === doc.documentElement ? null : scrollTarget;
  }

  function startSwipeAtPosition(
    event: SwipeDismissNativeEvent,
    position: { x: number; y: number },
    startOptions?: {
      ignoreScrollableTarget?: boolean | undefined;
      ignoreScrollableAncestors?: boolean | undefined;
    },
  ) {
    swipeFromScrollable = false;
    const touchLike = isTouchLikeEvent(event);
    const target = getTargetAtPoint(position, event);

    const doc = ownerDocument(getElement());
    const body = doc.body;

    const scrollableTarget =
      touchLike && body ? findGestureScrollableTouchTarget(target, body) : null;
    const ignoreScrollableTarget = startOptions?.ignoreScrollableTarget ?? false;
    if (scrollableTarget && !ignoreScrollableTarget) {
      return false;
    }
    swipeFromScrollable = Boolean(scrollableTarget && ignoreScrollableTarget);

    const isInteractiveElement = closest(target, DEFAULT_IGNORE_SELECTOR);
    if (isInteractiveElement && (!touchLike || ignoreSelectorWhenTouch())) {
      return false;
    }

    const element = getElement();
    if (ignoreScrollableAncestors() && element && target) {
      const ignoreAncestors = startOptions?.ignoreScrollableAncestors ?? false;
      if (!ignoreAncestors && findScrollableAncestor(target, element, scrollAxis()) != null) {
        return false;
      }
    }

    cancelledSwipe = false;
    intendedSwipeDirection = undefined;
    maxSwipeDisplacement = 0;

    dragStartPos = position;
    swipeStartTime = getValidTimeStamp(event.timeStamp);
    lastDragSample = null;
    hasStationarySample = false;
    lastDragVelocity = { x: 0, y: 0 };
    swipeCancelBaseline = position;
    lastMovePos = position;
    swipeThreshold = swipeThresholdDefault();
    const swipeThresholdOption = options.swipeThreshold;
    swipeThresholdFunction =
      typeof swipeThresholdOption === 'function' ? swipeThresholdOption : null;

    if (element) {
      elementSize = { width: element.offsetWidth, height: element.offsetHeight };
      resolveSwipeThreshold(primaryDirection());
      const transform = getElementTransform(element);

      initialTransform = transform;
      dragOffset = { x: transform.x, y: transform.y };
      recordDragSample({ x: transform.x, y: transform.y }, swipeStartTime);

      if (!isTouchEvent(event)) {
        safelyChangePointerCapture(element, event.pointerId, 'setPointerCapture');
      }
    }

    options.onSwipeStart?.(event);

    setSwiping(true);
    isFirstPointerMove = true;
    updateSwipeProgress(0);
    syncDragStyles(true);

    return true;
  }

  function resetPendingSwipeState() {
    clearPendingSwipeStartState();
    swipeFromScrollable = false;
    lastMovePos = null;
  }

  function clearPendingSwipeStartState() {
    pendingSwipe = false;
    pendingSwipeStartPos = null;
  }

  function cancelSwipeInteraction(event: PointerEvent) {
    resetPendingSwipeState();

    if (!isSwipingValue) {
      return;
    }

    setSwiping(false);

    dragOffset = { x: initialTransform.x, y: initialTransform.y };
    setCurrentSwipeDirection(undefined);
    sawPrimaryButtonsOnMove = false;
    syncDragStyles(false);

    const element = getElement();
    if (element) {
      safelyChangePointerCapture(element, event.pointerId, 'releasePointerCapture');
    }

    updateSwipeProgress(0, {
      deltaX: 0,
      deltaY: 0,
      direction: undefined,
    });

    options.onCancel?.(event);
  }

  function canSwipeFromScrollEdgeOnPendingMove(
    scrollTarget: HTMLElement,
    deltaX: number,
    deltaY: number,
  ): boolean | null {
    const list = directions();
    // Swiping toward the axis start edge (down/right) is allowed when scrolled to the start;
    // toward the end edge (up/left) when scrolled to the end.
    const canSwipeOnAxis = (
      delta: number,
      scrollOffset: number,
      maxScrollOffset: number,
      towardStart: SwipeDirection,
      towardEnd: SwipeDirection,
    ) =>
      (delta > 0 && scrollOffset <= 0 && list.includes(towardStart)) ||
      (delta < 0 && scrollOffset >= Math.max(0, maxScrollOffset) && list.includes(towardEnd));

    if (hasVertical() && deltaY !== 0) {
      return canSwipeOnAxis(
        deltaY,
        scrollTarget.scrollTop,
        scrollTarget.scrollHeight - scrollTarget.clientHeight,
        'down',
        'up',
      );
    }

    if (hasHorizontal() && deltaX !== 0) {
      return canSwipeOnAxis(
        deltaX,
        scrollTarget.scrollLeft,
        scrollTarget.scrollWidth - scrollTarget.clientWidth,
        'right',
        'left',
      );
    }

    return null;
  }

  function handleStart(event: SwipeDismissNativeEvent) {
    if (!enabled()) {
      return;
    }

    if (event.defaultPrevented) {
      return;
    }

    if (!isTouchEvent(event) && event.button !== 0) {
      return;
    }

    const startPos = getPrimaryPointerPosition(event);
    if (!startPos) {
      return;
    }

    pendingSwipe = true;
    pendingSwipeStartPos = startPos;
    swipeFromScrollable = false;
    sawPrimaryButtonsOnMove = !isTouchEvent(event);

    const canStart = options.canStart;
    const allowedToStart = canStart
      ? canStart(startPos, { nativeEvent: event, direction: primaryDirection() })
      : true;
    if (!allowedToStart) {
      return;
    }

    if (startSwipeAtPosition(event, startPos)) {
      clearPendingSwipeStartState();
    }
  }

  function handleMoveCore(
    event: SwipeDismissNativeEvent,
    currentTarget: EventTarget | null,
    position: { x: number; y: number },
    movement: { x: number; y: number },
  ) {
    if (!enabled() || !isSwipingValue) {
      return;
    }

    const list = directions();
    const target = getTarget(event) as HTMLElement | null;
    if (isTouchLikeEvent(event) && !swipeFromScrollable) {
      const boundaryElement = currentTarget as HTMLElement;
      if (boundaryElement && findGestureScrollableTouchTarget(target, boundaryElement)) {
        return;
      }
    }

    if (!isTouchEvent(event)) {
      // Prevent text selection on Safari
      event.preventDefault();
    }

    if (isFirstPointerMove) {
      isFirstPointerMove = false;
      // Reset the drag origin to the first move's position to absorb the gap between the press and
      // the first move event — notably on iOS touch, where the first `touchmove` arrives already
      // offset from the `touchstart` — which would otherwise make the dragged element jump. This
      // only matters when an element follows the pointer; when `trackDrag` is false (e.g. the
      // swipe-area, which only opens the drawer) keep the original press position so a quick flick
      // still registers.
      if (trackDrag()) {
        dragStartPos = position;
        const moveTime = getValidTimeStamp(event.timeStamp);
        if (moveTime !== null) {
          swipeStartTime = moveTime;
        }
        lastDragSample = null;
        hasStationarySample = false;
      }
    }

    swipeCancelBaseline = updateSwipeCancelBaseline(swipeCancelBaseline, position, movement);

    const deltaX = position.x - dragStartPos.x;
    const deltaY = position.y - dragStartPos.y;
    const cancelDeltaY = position.y - swipeCancelBaseline.y;
    const cancelDeltaX = position.x - swipeCancelBaseline.x;

    if (!intendedSwipeDirection) {
      let candidate: SwipeDirection;
      if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        candidate = deltaX > 0 ? 'right' : 'left';
      } else {
        candidate = deltaY > 0 ? 'down' : 'up';
      }
      if (list.includes(candidate)) {
        intendedSwipeDirection = candidate;
        maxSwipeDisplacement = getDisplacement(candidate, deltaX, deltaY);
        setCurrentSwipeDirection(candidate);
        resolveSwipeThreshold(candidate);
      }
    } else {
      const direction = intendedSwipeDirection;
      const currentDisplacement = getDisplacement(direction, cancelDeltaX, cancelDeltaY);
      if (currentDisplacement > swipeThreshold) {
        cancelledSwipe = false;
        setCurrentSwipeDirection(direction);
      } else if (shouldCancelReverseSwipe(list, maxSwipeDisplacement, currentDisplacement)) {
        // Mark that a change-of-mind has occurred
        cancelledSwipe = true;
      }
    }

    const dampedDelta = applyDirectionalDamping(deltaX, deltaY, list);
    let newOffsetX = initialTransform.x;
    let newOffsetY = initialTransform.y;

    if (hasHorizontal()) {
      newOffsetX += dampedDelta.x;
    }
    if (hasVertical()) {
      newOffsetY += dampedDelta.y;
    }

    // Only rewrite drag styles when the drag offset actually changed: `updateSwipeProgress`
    // dedupes unchanged deltas, so the consumer's `onProgress` would not correct raw styles.
    const previousOffset = dragOffset;
    const offsetChanged = newOffsetX !== previousOffset.x || newOffsetY !== previousOffset.y;

    dragOffset = { x: newOffsetX, y: newOffsetY };
    if (offsetChanged) {
      syncDragStyles(true);
    }
    recordDragSample({ x: newOffsetX, y: newOffsetY }, getValidTimeStamp(event.timeStamp));
    const dragDeltaX = newOffsetX - initialTransform.x;
    const dragDeltaY = newOffsetY - initialTransform.y;
    const progressDetails: SwipeProgressDetailsInternal = {
      deltaX: dragDeltaX,
      deltaY: dragDeltaY,
      direction: intendedSwipeDirection,
    };

    let progress = 0;
    const progressDirection = primaryDirection() ?? intendedSwipeDirection;
    if (progressDirection) {
      const size =
        progressDirection === 'left' || progressDirection === 'right'
          ? elementSize.width
          : elementSize.height;
      const scale = initialTransform.scale || 1;
      const progressDisplacement = getDisplacement(progressDirection, dragDeltaX, dragDeltaY);
      if (size > 0 && scale > 0 && progressDisplacement > 0) {
        progress = progressDisplacement / (size * scale);
      }
    }

    updateSwipeProgress(progress, progressDetails);
  }

  function handleEnd(event: SwipeDismissNativeEvent) {
    if (!enabled()) {
      return;
    }

    const resolvedDragOffset = dragOffset;
    const resolvedInitialTransform = initialTransform;
    const deltaX = resolvedDragOffset.x - resolvedInitialTransform.x;
    const deltaY = resolvedDragOffset.y - resolvedInitialTransform.y;
    const progressDetails: SwipeProgressDetailsInternal = {
      deltaX,
      deltaY,
      direction: intendedSwipeDirection,
    };

    if (!isSwipingValue) {
      resetPendingSwipeState();
      updateSwipeProgress(0, progressDetails);
      return;
    }

    setSwiping(false);
    resetPendingSwipeState();
    sawPrimaryButtonsOnMove = false;

    const element = getElement();
    if (element && !isTouchEvent(event)) {
      safelyChangePointerCapture(element, event.pointerId, 'releasePointerCapture');
    }

    const startTime = swipeStartTime;
    const endTime = getValidTimeStamp(event.timeStamp);
    const durationMs =
      startTime !== null && endTime !== null && endTime > startTime ? endTime - startTime : 0;
    const velocityDurationMs = durationMs > 0 ? Math.max(durationMs, MIN_VELOCITY_DURATION_MS) : 0;
    const velocityX = velocityDurationMs > 0 ? deltaX / velocityDurationMs : 0;
    const velocityY = velocityDurationMs > 0 ? deltaY / velocityDurationMs : 0;
    let releaseVelocityX = lastDragVelocity.x;
    let releaseVelocityY = lastDragVelocity.y;
    const lastSample = lastDragSample;
    if (lastSample && endTime !== null && endTime >= lastSample.time) {
      const ageMs = endTime - lastSample.time;
      if (ageMs <= MAX_RELEASE_VELOCITY_AGE_MS) {
        const sampleDurationMs = Math.max(ageMs, MIN_RELEASE_VELOCITY_DURATION_MS);
        const deltaFromLastSampleX = resolvedDragOffset.x - lastSample.x;
        const deltaFromLastSampleY = resolvedDragOffset.y - lastSample.y;
        const sampleVelocityX = deltaFromLastSampleX / sampleDurationMs;
        const sampleVelocityY = deltaFromLastSampleY / sampleDurationMs;
        if (Math.abs(deltaFromLastSampleX) >= MIN_VELOCITY_SAMPLE_DISTANCE) {
          releaseVelocityX = sampleVelocityX;
        }
        if (Math.abs(deltaFromLastSampleY) >= MIN_VELOCITY_SAMPLE_DISTANCE) {
          releaseVelocityY = sampleVelocityY;
        }
      } else {
        releaseVelocityX = 0;
        releaseVelocityY = 0;
      }
    }

    const releaseDecision = options.onRelease?.({
      event,
      direction: intendedSwipeDirection,
      deltaX,
      deltaY,
      velocityX,
      velocityY,
      releaseVelocityX,
      releaseVelocityY,
    });
    const hasReleaseDecision = typeof releaseDecision === 'boolean';

    let shouldClose = false;
    let dismissDirection: SwipeDirection | undefined;

    if (hasReleaseDecision) {
      shouldClose = releaseDecision;
      dismissDirection = intendedSwipeDirection ?? primaryDirection();
    } else if (!cancelledSwipe) {
      dismissDirection = getDismissDirection(directions(), deltaX, deltaY, swipeThreshold);
      shouldClose = dismissDirection !== undefined;
    }

    if (shouldClose && dismissDirection) {
      setCurrentSwipeDirection(dismissDirection);
      setDragDismissed(true);
      syncDragStyles(false);
      options.onDismiss?.(event, { direction: dismissDirection });
    } else {
      dragOffset = { x: resolvedInitialTransform.x, y: resolvedInitialTransform.y };
      setCurrentSwipeDirection(undefined);
      syncDragStyles(false);
      updateSwipeProgress(0, progressDetails);
    }
  }

  function handleMove(event: SwipeDismissNativeEvent, currentTarget: EventTarget | null) {
    const currentPos = getPrimaryPointerPosition(event);
    if (!currentPos) {
      return;
    }

    let endAfterMove = false;

    if (!isTouchEvent(event)) {
      const hasPrimaryButton = hasPrimaryMouseButton(event.buttons);
      if (hasPrimaryButton) {
        sawPrimaryButtonsOnMove = true;
      }

      // Cancel the swipe if a non-primary button takes over the interaction.
      // This handles cases where a right-click interrupts dragging.
      if (event.buttons !== 0 && !hasPrimaryButton) {
        cancelSwipeInteraction(event);
        return;
      }

      // A `buttons: 0` pointermove means the primary button was already released, so the gesture is
      // over even if no pointerup reached us. On fast trackpad flicks this trailing move is
      // dispatched just before pointerup; treat it as the release (mirroring touchend) instead of
      // cancelling and snapping the element back.
      if (event.buttons === 0 && sawPrimaryButtonsOnMove) {
        if (!isSwipingValue) {
          // The gesture never activated — discard it.
          handleEnd(event);
          return;
        }
        endAfterMove = true;
      }
    }

    if (!isSwipingValue && pendingSwipe) {
      if (!isTouchLikeEvent(event) && event.defaultPrevented) {
        resetPendingSwipeState();
        return;
      }

      const canStart = options.canStart;
      const allowedToStart = canStart
        ? canStart(currentPos, { nativeEvent: event, direction: primaryDirection() })
        : true;

      if (allowedToStart) {
        const pendingStartPos = pendingSwipeStartPos;
        let ignoreScrollableOnStart = false;
        if (isTouchLikeEvent(event)) {
          const element = getElement();
          if (pendingStartPos && element) {
            const target = getTargetAtPoint(currentPos, event);
            const doc = ownerDocument(element);
            const body = doc.body;
            const scrollTarget = body ? findGestureScrollableTouchTarget(target, body) : null;

            if (
              scrollTarget &&
              (contains(element, scrollTarget) || contains(scrollTarget, element))
            ) {
              const deltaX = currentPos.x - pendingStartPos.x;
              const deltaY = currentPos.y - pendingStartPos.y;
              const canSwipeFromEdge = canSwipeFromScrollEdgeOnPendingMove(
                scrollTarget,
                deltaX,
                deltaY,
              );

              if (canSwipeFromEdge === false) {
                return;
              }

              if (canSwipeFromEdge === true) {
                ignoreScrollableOnStart = true;
              }
            }
          }
        }

        const started = startSwipeAtPosition(event, currentPos, {
          ignoreScrollableTarget: ignoreScrollableOnStart,
          ignoreScrollableAncestors: ignoreScrollableOnStart,
        });
        if (started) {
          if (pendingStartPos && ignoreScrollableOnStart) {
            // Preserve displacement between touchstart and the move that activates swipe from
            // a scroll-edge so quick flicks can dismiss.
            clearPendingSwipeStartState();
            dragStartPos = pendingStartPos;
            swipeCancelBaseline = pendingStartPos;
            lastMovePos = pendingStartPos;
            isFirstPointerMove = false;
          } else {
            // Start from the current in-bounds position without dropping follow-up move
            // displacement; this avoids jumps when entering from outside the element while
            // keeping swipe tracking responsive on the next move.
            clearPendingSwipeStartState();
            swipeFromScrollable = false;
          }
        }
      }
    }

    const previousPos = lastMovePos;
    const movement =
      previousPos === null
        ? { x: 0, y: 0 }
        : { x: currentPos.x - previousPos.x, y: currentPos.y - previousPos.y };

    lastMovePos = currentPos;
    handleMoveCore(event, currentTarget, currentPos, movement);

    if (endAfterMove) {
      handleEnd(event);
    }
  }

  function moveNative(nativeEvent: TouchEvent, currentTarget: HTMLElement) {
    handleMove(nativeEvent, currentTarget);
  }

  function getDragStyles(): JSX.CSSProperties {
    // Track the swipe/dismiss state, but compute from the imperative values so a style update
    // that runs before the signals flush doesn't strip the transform `syncDragStyles` wrote.
    isSwiping();
    dragDismissed();
    const movementCssVars = options.movementCssVars;
    const swiping = isSwipingValue;
    const deltaX = dragOffset.x - initialTransform.x;
    const deltaY = dragOffset.y - initialTransform.y;

    if (!swiping && deltaX === 0 && deltaY === 0 && !dragDismissedValue) {
      return {
        [movementCssVars.x]: '0px',
        [movementCssVars.y]: '0px',
      } as JSX.CSSProperties;
    }

    return {
      transition: swiping ? 'none' : undefined,
      // While swiping, freeze the element at its current visual transform so it doesn't snap to the
      // end position.
      transform: swiping ? getDragTransform(dragOffset, initialTransform.scale) : undefined,
      [movementCssVars.x]: `${deltaX}px`,
      [movementCssVars.y]: `${deltaY}px`,
    } as JSX.CSSProperties;
  }

  // Upstream hands out these handlers only while enabled; they are stable here, so they check it.
  const pointerProps: SwipeDismissPointerProps = {
    onPointerDown: (event) => handleStart(event),
    onPointerMove: (event) => {
      if (enabled()) {
        handleMove(event, event.currentTarget);
      }
    },
    onPointerUp: (event) => handleEnd(event),
    onPointerCancel: (event) => handleEnd(event),
  };

  const touchProps: SwipeDismissTouchProps = {
    onTouchStart: (event) => handleStart(event),
    onTouchMove: (event) => {
      if (enabled()) {
        handleMove(event, event.currentTarget);
      }
    },
    onTouchEnd: (event) => handleEnd(event),
    onTouchCancel: (event) => handleEnd(event),
  };

  return {
    swiping: isSwiping,
    swipeDirection: currentSwipeDirection,
    dragDismissed,
    pointerProps,
    touchProps,
    getPointerProps: () => (enabled() ? pointerProps : {}),
    getTouchProps: () => (enabled() ? touchProps : {}),
    isSwiping: () => isSwipingValue,
    moveNative,
    getDragStyles,
    reset,
  };
}

export interface SwipeDismissDetails {
  nativeEvent: PointerEvent | TouchEvent;
  direction: SwipeDirection | undefined;
}

export type SwipeDismissProgressDetails = SwipeProgressDetailsInternal;

export interface SwipeDismissReleaseDetails {
  event: PointerEvent | TouchEvent;
  direction: SwipeDirection | undefined;
  deltaX: number;
  deltaY: number;
  velocityX: number;
  velocityY: number;
  releaseVelocityX: number;
  releaseVelocityY: number;
}

export interface CreateSwipeDismissOptions {
  /**
   * Whether swipe handling is enabled. Read lazily (pass a getter for a reactive value).
   */
  enabled: boolean;
  /**
   * The directions the element can be swiped in. All of them must be on the same axis.
   */
  directions: SwipeDirection[];
  /**
   * The swiped element.
   */
  element: Accessor<HTMLElement | null | undefined>;
  /**
   * The CSS variables that receive the drag movement on each axis.
   */
  movementCssVars: { x: string; y: string };
  /**
   * The minimum distance (in pixels) the pointer must travel from the initial swipe point
   * before the gesture is considered a dismiss.
   * @default 40
   */
  swipeThreshold?:
    | number
    | ((details: { element: HTMLElement; direction: SwipeDirection }) => number)
    | undefined;
  /**
   * If provided, swiping will only begin once this returns true.
   * The predicate is evaluated on start and on subsequent move events while the pointer is down.
   */
  canStart?:
    | ((position: { x: number; y: number }, details: SwipeDismissDetails) => boolean)
    | undefined;
  /**
   * If true, swiping won't start when the gesture begins within a scrollable element.
   * @default false
   */
  ignoreScrollableAncestors?: boolean | undefined;
  /**
   * If false, touch interactions can start swiping on interactive elements
   * that are ignored during pointer swipes.
   * @default true
   */
  ignoreSelectorWhenTouch?: boolean | undefined;
  /**
   * Whether to apply drag transform and movement styles to the element imperatively during a swipe.
   * Disable for event-only usage where the consumer drives styling itself.
   * @default true
   */
  trackDrag?: boolean | undefined;
  onSwipeStart?: ((event: PointerEvent | TouchEvent) => void) | undefined;
  onProgress?: ((progress: number, details?: SwipeDismissProgressDetails) => void) | undefined;
  onCancel?: ((event: PointerEvent | TouchEvent) => void) | undefined;
  /**
   * Called when the swipe interaction starts or ends.
   */
  onSwipingChange?: ((swiping: boolean) => void) | undefined;
  /**
   * Called when the swipe interaction ends. Returning `true` or `false`
   * overrides the default dismissal behavior.
   */
  onRelease?: ((details: SwipeDismissReleaseDetails) => boolean | void) | undefined;
  onDismiss?:
    | ((event: PointerEvent | TouchEvent, details: { direction: SwipeDirection }) => void)
    | undefined;
}

export interface SwipeDismissPointerProps {
  onPointerDown?: ((event: PointerEvent) => void) | undefined;
  onPointerMove?: ((event: PointerEvent) => void) | undefined;
  onPointerUp?: ((event: PointerEvent) => void) | undefined;
  onPointerCancel?: ((event: PointerEvent) => void) | undefined;
}

export interface SwipeDismissTouchProps {
  onTouchStart?: ((event: TouchEvent) => void) | undefined;
  onTouchMove?: ((event: TouchEvent) => void) | undefined;
  onTouchEnd?: ((event: TouchEvent) => void) | undefined;
  onTouchCancel?: ((event: TouchEvent) => void) | undefined;
}

export interface CreateSwipeDismissReturnValue {
  /** Whether a swipe is in progress (tracked; lags the imperative state until flush). */
  swiping: Accessor<boolean>;
  /** The direction of the current or dismissing swipe (tracked). */
  swipeDirection: Accessor<SwipeDirection | undefined>;
  /** Whether the last swipe dismissed the element (tracked). */
  dragDismissed: Accessor<boolean>;
  /** Stable pointer handlers. They do nothing while disabled. */
  pointerProps: SwipeDismissPointerProps;
  /** Stable touch handlers. They do nothing while disabled. */
  touchProps: SwipeDismissTouchProps;
  /** The pointer handlers, or an empty object while disabled (reads `enabled`). */
  getPointerProps: () => SwipeDismissPointerProps;
  /** The touch handlers, or an empty object while disabled (reads `enabled`). */
  getTouchProps: () => SwipeDismissTouchProps;
  /** Whether a swipe is in progress, read synchronously (untracked). */
  isSwiping: () => boolean;
  /**
   * Feeds a native touchmove into the swipe pipeline. Used by consumers that claim the gesture
   * in a capture-phase listener and stop it from reaching delegated touch handlers.
   */
  moveNative: (nativeEvent: TouchEvent, currentTarget: HTMLElement) => void;
  /** The drag styles matching the current gesture (tracked). */
  getDragStyles: () => JSX.CSSProperties;
  /** Resets the gesture state and the drag styles. */
  reset: () => void;
}
