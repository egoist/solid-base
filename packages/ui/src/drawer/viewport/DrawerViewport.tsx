import { createEffect, createMemo, createSignal, flush, omit, onSettled, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isElement } from '@floating-ui/utils/dom';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { ownerDocument, ownerWindow } from '@egoist/solid-base-utils/owner';
import { createAnimationFrame } from '@egoist/solid-base-utils/animationFrame';
import { clamp } from '@egoist/solid-base-utils/clamp';
import { activeElement, closest, contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { DialogViewport } from '../../dialog/viewport/DialogViewport';
import * as DialogViewportDataAttributes from '../../dialog/viewport/DialogViewportDataAttributes';
import { mergeProps } from '../../merge-props/mergeProps';
import { useDrawerRootContext } from '../root/DrawerRootContext';
import type { DrawerSnapPoint } from '../root/DrawerRootContext';
import {
  closestSnapPointIndex,
  createDrawerSnapPoints,
  getSnapPointSwipeMovement,
} from '../root/useDrawerSnapPoints';
import type { ResolvedDrawerSnapPoint } from '../root/useDrawerSnapPoints';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import { createSwipeDismiss, getDisplacement } from '../../utils/swipeDismiss';
import type { SwipeDirection, SwipeDismissProgressDetails } from '../../utils/swipeDismiss';
import * as DrawerPopupCssVars from '../popup/DrawerPopupCssVars';
import * as DrawerPopupDataAttributes from '../popup/DrawerPopupDataAttributes';
import * as DrawerBackdropCssVars from '../backdrop/DrawerBackdropCssVars';
import { DRAWER_CONTENT_ATTRIBUTE } from '../content/drawerContentAttribute';
import { REASONS } from '../../internals/reasons';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { DrawerViewportContext, type DrawerViewportContextValue } from './DrawerViewportContext';
import { TransitionStatusDataAttributes } from '../../internals/stateAttributesMapping';
import { findScrollableTouchTarget } from '../../utils/scrollable';
import type { ScrollAxis } from '../../utils/scrollable';
import {
  BASE_UI_SWIPE_IGNORE_ATTRIBUTE,
  BASE_UI_SWIPE_IGNORE_SELECTOR,
} from '../../internals/constants';
import { getElementAtPoint } from '../../utils/getElementAtPoint';
import type { BaseUIComponentProps } from '../../internals/types';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { useDrawerVirtualKeyboardContext } from '../virtual-keyboard-provider/DrawerVirtualKeyboardContext';
import type { DrawerRoot } from '../root/DrawerRoot';

const MIN_SWIPE_THRESHOLD = 10;
const FAST_SWIPE_VELOCITY = 0.5;
const SNAP_VELOCITY_THRESHOLD = 0.5;
const SNAP_VELOCITY_MULTIPLIER = 300;
const MAX_SNAP_VELOCITY = 4;
const MIN_SWIPE_RELEASE_VELOCITY = 0.2;
const MAX_SWIPE_RELEASE_VELOCITY = 4;
const MIN_SWIPE_RELEASE_DURATION_MS = 80;
const MAX_SWIPE_RELEASE_DURATION_MS = 360;
const MIN_SWIPE_RELEASE_SCALAR = 0.1;
const MAX_SWIPE_RELEASE_SCALAR = 1;
const AXIS_LOCK_SLOP = 6;
const AXIS_LOCK_BIAS = 2;
const DRAWER_CONTENT_SELECTOR = `[${DRAWER_CONTENT_ATTRIBUTE}]`;
const AXIS_SWIPE_IGNORE_SELECTORS: Record<ScrollAxis, string> = {
  horizontal: `[${BASE_UI_SWIPE_IGNORE_ATTRIBUTE}="x"]`,
  vertical: `[${BASE_UI_SWIPE_IGNORE_ATTRIBUTE}="y"]`,
};

interface TouchScrollState {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startedInPopup: boolean;
  scrollTarget: HTMLElement | null;
  hasCrossAxisGestureTarget: boolean;
  allowSwipe: boolean | null;
  preserveNativeCrossAxisScroll: boolean;
  drawerAxisAttributed: boolean;
}

/**
 * A positioning container for the drawer popup that can be made scrollable.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerViewport(componentProps: DrawerViewport.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children');

  const store = useDialogRootContext();
  const drawer = useDrawerRootContext();
  const providerContext = useDrawerProviderContext();
  const snap = createDrawerSnapPoints();
  const virtualKeyboard = useDrawerVirtualKeyboardContext();

  const notifyParentSwipingChange = drawer.notifyParentSwipingChange;
  const notifyParentSwipeProgressChange = drawer.notifyParentSwipeProgressChange;
  const visualStateStore = providerContext?.visualStateStore;

  const open = () => store.select('open');
  const mounted = () => store.select('mounted');
  const nested = () => store.select('nested');
  const nestedDrawerOpen = () => store.select('nestedOpenDrawerCount') > 0;
  const getPopupElement = () => store.state.popupElement;
  const getBackdropElement = () => store.context.backdropElement;

  const [swipeRelease, setSwipeRelease] = createSignal<number | null>(null);

  let pendingSwipeCloseSnapPoint: DrawerSnapPoint | null | undefined;
  const controlledDismissFrame = createAnimationFrame();

  let swipingValue = false;
  let nestedSwipeActive = false;
  let lastPointerType = '';
  let ignoreNextTouchStartFromPen = false;
  let ignoreTouchSwipe = false;
  let touchScrollState: TouchScrollState | null = null;

  const snapPointRange = createMemo(() => {
    const snapPoints = snap.snapPoints;
    const resolvedSnapPoints = snap.resolvedSnapPoints;
    const swipeDirection = drawer.swipeDirection;
    if (
      !snapPoints ||
      snapPoints.length < 2 ||
      resolvedSnapPoints.length < 2 ||
      (swipeDirection !== 'down' && swipeDirection !== 'up')
    ) {
      return null;
    }

    const offsets = resolvedSnapPoints.map((point) => point.offset).sort((a, b) => a - b);

    const minOffset = offsets[0];
    const nextOffset = offsets[1];
    const range = nextOffset - minOffset;

    return { minOffset, range };
  });

  const snapPointProgress = createMemo(() => {
    const range = snapPointRange();
    const activeSnapPointOffset = snap.activeSnapPointOffset;
    if (!range || activeSnapPointOffset === null) {
      return null;
    }

    return clamp((activeSnapPointOffset - range.minOffset) / range.range, 0, 1);
  });

  const swipeDirections = createMemo<SwipeDirection[]>(() => {
    const snapPoints = snap.snapPoints;
    const swipeDirection = drawer.swipeDirection;
    if (
      snapPoints &&
      snapPoints.length > 0 &&
      (swipeDirection === 'down' || swipeDirection === 'up')
    ) {
      return swipeDirection === 'down' ? ['down', 'up'] : ['up', 'down'];
    }

    return [swipeDirection];
  });

  const scrollAxis = (): ScrollAxis => {
    const swipeDirection = drawer.swipeDirection;
    return swipeDirection === 'left' || swipeDirection === 'right' ? 'horizontal' : 'vertical';
  };

  function setSwipeDismissed(dismissed: boolean) {
    getPopupElement()?.toggleAttribute(DrawerPopupDataAttributes.swipeDismiss, dismissed);
    getBackdropElement()?.toggleAttribute(DrawerPopupDataAttributes.swipeDismiss, dismissed);
  }

  function clearSwipeRelease() {
    setSwipeDismissed(false);
    getPopupElement()?.removeAttribute(TransitionStatusDataAttributes.endingStyle);
    setSwipeRelease(null);
  }

  function finishNestedSwipe() {
    if (!nestedSwipeActive) {
      return;
    }

    nestedSwipeActive = false;
    notifyParentSwipingChange?.(false);
  }

  function applySwipeProgress(
    resolvedProgress: number,
    shouldTrackProgress: boolean,
    notifyParent: boolean,
  ) {
    untrack(() => {
      const isOpen = open();
      const isActive = isOpen && !nested() && shouldTrackProgress;
      const swipeProgress = isActive ? resolvedProgress : 0;
      const nestedSwipeProgress = isOpen && shouldTrackProgress ? resolvedProgress : 0;
      const frontmostHeight = drawer.frontmostHeight;

      if (notifyParent && notifyParentSwipeProgressChange) {
        notifyParentSwipeProgressChange(nestedSwipeProgress);

        if (nestedSwipeProgress <= 0) {
          finishNestedSwipe();
        }
      }

      visualStateStore?.set({
        swipeProgress,
        frontmostHeight: swipeProgress > 0 ? frontmostHeight : 0,
      });

      const backdropElement = getBackdropElement();
      if (!backdropElement) {
        return;
      }

      const showProgress = isActive && swipeProgress > 0;
      backdropElement.style.setProperty(
        DrawerBackdropCssVars.swipeProgress,
        showProgress ? `${swipeProgress}` : '0',
      );
      if (showProgress && frontmostHeight > 0) {
        backdropElement.style.setProperty(DrawerPopupCssVars.height, `${frontmostHeight}px`);
      } else {
        backdropElement.style.removeProperty(DrawerPopupCssVars.height);
      }
    });
  }

  function resolveSwipeRelease(
    popupElement: HTMLElement,
    direction: SwipeDirection,
    deltaX: number,
    deltaY: number,
    velocityX: number,
    velocityY: number,
    releaseVelocityX: number,
    releaseVelocityY: number,
  ): number | null {
    const size = getBaseSwipeSize(popupElement, direction);
    if (size <= 0) {
      return null;
    }

    const snapPoints = snap.snapPoints;
    // The snap point base offset shifts the popup along the dismiss direction for both
    // `down` (+offset) and `up` (-offset), so it always adds to the directional translation.
    const snapPointBaseOffset =
      (direction === 'down' || direction === 'up') && snapPoints && snapPoints.length > 0
        ? (snap.activeSnapPointOffset ?? 0)
        : 0;
    const translationAlongDirection =
      snapPointBaseOffset + getDisplacement(direction, deltaX, deltaY);
    const remainingDistance = Math.max(0, size - translationAlongDirection);
    if (remainingDistance <= 0) {
      return null;
    }

    const releaseVelocity = getDisplacement(direction, releaseVelocityX, releaseVelocityY);
    const directionalVelocity =
      Math.abs(releaseVelocity) > 0
        ? releaseVelocity
        : getDisplacement(direction, velocityX, velocityY);
    if (directionalVelocity <= MIN_SWIPE_RELEASE_VELOCITY) {
      return null;
    }

    const clampedVelocity = clamp(
      directionalVelocity,
      MIN_SWIPE_RELEASE_VELOCITY,
      MAX_SWIPE_RELEASE_VELOCITY,
    );
    const durationMs = clamp(
      remainingDistance / clampedVelocity,
      MIN_SWIPE_RELEASE_DURATION_MS,
      MAX_SWIPE_RELEASE_DURATION_MS,
    );
    const normalizedDuration =
      (durationMs - MIN_SWIPE_RELEASE_DURATION_MS) /
      (MAX_SWIPE_RELEASE_DURATION_MS - MIN_SWIPE_RELEASE_DURATION_MS);
    return (
      MIN_SWIPE_RELEASE_SCALAR +
      normalizedDuration * (MAX_SWIPE_RELEASE_SCALAR - MIN_SWIPE_RELEASE_SCALAR)
    );
  }

  function updateNestedSwipeActive(details?: SwipeDismissProgressDetails) {
    if (nestedSwipeActive || !details) {
      return;
    }

    const direction = details.direction ?? drawer.swipeDirection;
    const delta = getDisplacement(direction, details.deltaX, details.deltaY);
    if (Math.abs(delta) < MIN_SWIPE_THRESHOLD) {
      return;
    }

    nestedSwipeActive = true;
    notifyParentSwipingChange?.(true);
  }

  const swipe = createSwipeDismiss({
    get enabled() {
      return mounted() && !nestedDrawerOpen();
    },
    get directions() {
      return swipeDirections();
    },
    element: getPopupElement,
    ignoreSelectorWhenTouch: false,
    ignoreScrollableAncestors: true,
    movementCssVars: {
      x: DrawerPopupCssVars.swipeMovementX,
      y: DrawerPopupCssVars.swipeMovementY,
    },
    onSwipeStart(event) {
      if ('touches' in event || event.pointerType === 'touch') {
        return;
      }

      const popupElement = getPopupElement();

      const doc = ownerDocument(popupElement);
      const selection = doc.getSelection?.();
      if (!selection || selection.isCollapsed) {
        return;
      }

      const anchorElement = isElement(selection.anchorNode)
        ? selection.anchorNode
        : selection.anchorNode?.parentElement;
      const focusElement = isElement(selection.focusNode)
        ? selection.focusNode
        : selection.focusNode?.parentElement;

      if (!contains(popupElement, anchorElement) && !contains(popupElement, focusElement)) {
        return;
      }

      selection.removeAllRanges();
    },
    onSwipingChange(swiping) {
      swipingValue = swiping;
      setBackdropSwipingAttribute(getBackdropElement(), swiping);

      if (!swiping && !notifyParentSwipeProgressChange) {
        finishNestedSwipe();
      }
    },
    swipeThreshold({ element, direction }) {
      return getBaseSwipeThreshold(element, direction);
    },
    canStart(position, details) {
      const popupElement = getPopupElement();
      if (!popupElement) {
        return false;
      }

      const nativeEvent = details.nativeEvent;
      const touchLike = 'touches' in nativeEvent || nativeEvent.pointerType === 'touch';
      const touchState = touchLike ? touchScrollState : null;

      const doc = popupElement.ownerDocument;
      const elementAtPoint = getElementAtPoint(popupElement.getRootNode(), position.x, position.y);
      // Activation can be deferred until after a touch that started inside has left the popup.
      if (!touchState?.startedInPopup && !contains(popupElement, elementAtPoint)) {
        return false;
      }

      if (touchLike && shouldIgnoreSwipeForTextSelection(doc, popupElement)) {
        return false;
      }

      // Over a cross-axis gesture target, stay pending until the drawer axis wins the gesture.
      if (
        touchState?.hasCrossAxisGestureTarget &&
        !touchState.drawerAxisAttributed &&
        touchState.allowSwipe !== true
      ) {
        return false;
      }

      return true;
    },
    onProgress(progress, details) {
      untrack(() => {
        const swiping = swipingValue;

        if (swiping) {
          updateNestedSwipeActive(details);
        }

        const snapPoints = snap.snapPoints;
        const activeSnapPointOffset = snap.activeSnapPointOffset;
        const hasSnapPoints = Boolean(snapPoints && snapPoints.length > 0);
        if (swiping && drawer.swipeDirection === 'down' && hasSnapPoints && details) {
          const popupElement = getPopupElement();
          if (popupElement) {
            popupElement.style.removeProperty('transform');
            popupElement.style.setProperty(
              DrawerPopupCssVars.swipeMovementY,
              `${getSnapPointSwipeMovement(activeSnapPointOffset ?? 0, details.deltaY)}px`,
            );
          }
        }

        let resolvedProgress = progress;
        const range = snapPointRange();
        const popupHeight = snap.popupHeight;
        if (range && popupHeight > 0) {
          const baseOffset = activeSnapPointOffset ?? range.minOffset;
          const offsetToProgress = (nextOffset: number) =>
            clamp((nextOffset - range.minOffset) / range.range, 0, 1);

          // Outside a drag the primitive still reports the last drag deltas, both after a release
          // and on a gesture that never started (e.g. a press inside `Drawer.Content`).
          // Recomputing from them would re-apply drag progress to a drawer that rests on its
          // snap point.
          const currentProgress = snapPointProgress();
          if (swiping && details && Number.isFinite(details.deltaY)) {
            resolvedProgress = offsetToProgress(clamp(baseOffset + details.deltaY, 0, popupHeight));
          } else if (currentProgress !== null) {
            resolvedProgress = currentProgress;
          }
        }

        // A parent drawer follows an active drag only, so drop it back to zero once the drag ends.
        if (!swiping) {
          notifyParentSwipeProgressChange?.(0);
          finishNestedSwipe();
        }

        applySwipeProgress(resolvedProgress, true, swiping);
      });
    },
    onRelease({
      event,
      deltaX,
      deltaY,
      direction,
      velocityX,
      velocityY,
      releaseVelocityX,
      releaseVelocityY,
    }) {
      const popupElement = getPopupElement();
      if (!popupElement) {
        clearSwipeRelease();
        return undefined;
      }
      const releasePopupElement = popupElement;

      const snapPoints = snap.snapPoints;
      const swipeDirection = drawer.swipeDirection;
      const popupHeight = snap.popupHeight;
      const resolvedSnapPoints = snap.resolvedSnapPoints;
      const activeSnapPoint = snap.activeSnapPoint;
      const activeSnapPointOffset = snap.activeSnapPointOffset;

      function startSwipeRelease(resolvedDirection: SwipeDirection) {
        // Start ending transition styles earlier and synchronously to prevent a period where
        // the popup appears stuck on release before the actual closing animation starts.
        finishNestedSwipe();
        setSwipeDismissed(true);

        releasePopupElement.style.removeProperty('transition');
        releasePopupElement.setAttribute(TransitionStatusDataAttributes.endingStyle, '');
        setSwipeRelease(
          resolveSwipeRelease(
            releasePopupElement,
            resolvedDirection,
            deltaX,
            deltaY,
            velocityX,
            velocityY,
            releaseVelocityX,
            releaseVelocityY,
          ),
        );
        flush();
      }

      if (!snapPoints || snapPoints.length === 0) {
        if (!direction) {
          clearSwipeRelease();
          return undefined;
        }

        const directionalDelta = getDisplacement(direction, deltaX, deltaY);
        if (directionalDelta <= 0) {
          clearSwipeRelease();
          return false;
        }

        if (getDisplacement(direction, velocityX, velocityY) >= FAST_SWIPE_VELOCITY) {
          startSwipeRelease(direction);
          return true;
        }

        const shouldClose =
          directionalDelta > getBaseSwipeThreshold(releasePopupElement, direction);
        if (shouldClose) {
          startSwipeRelease(direction);
        } else {
          clearSwipeRelease();
        }
        return shouldClose;
      }

      if (swipeDirection !== 'down' && swipeDirection !== 'up') {
        clearSwipeRelease();
        return undefined;
      }

      if (!popupHeight) {
        clearSwipeRelease();
        return false;
      }

      if (resolvedSnapPoints.length === 0) {
        clearSwipeRelease();
        return undefined;
      }

      const dragDelta = swipeDirection === 'down' ? deltaY : -deltaY;
      const dragDirection = Math.sign(dragDelta);
      const releaseDirectionalVelocity =
        swipeDirection === 'down' ? releaseVelocityY : -releaseVelocityY;
      const fallbackDirectionalVelocity = swipeDirection === 'down' ? velocityY : -velocityY;
      let resolvedDirectionalVelocity = releaseDirectionalVelocity;
      if (dragDirection !== 0 && Math.abs(dragDelta) >= MIN_SWIPE_THRESHOLD) {
        const velocityDirection = Math.sign(resolvedDirectionalVelocity);
        if (velocityDirection !== 0 && velocityDirection !== dragDirection) {
          // Ignore touch reversals that would otherwise flip the snap decision.
          resolvedDirectionalVelocity = fallbackDirectionalVelocity;
        }
      }

      const currentOffset = activeSnapPointOffset ?? 0;
      const dragTargetOffset = clamp(currentOffset + dragDelta, 0, popupHeight);
      const velocityOffset =
        Math.abs(resolvedDirectionalVelocity) >= SNAP_VELOCITY_THRESHOLD
          ? clamp(resolvedDirectionalVelocity, -MAX_SNAP_VELOCITY, MAX_SNAP_VELOCITY) *
            SNAP_VELOCITY_MULTIPLIER
          : 0;
      const targetOffset = drawer.snapToSequentialPoints
        ? dragTargetOffset
        : clamp(dragTargetOffset + velocityOffset, 0, popupHeight);
      const snapPointEventDetails = createChangeEventDetails(
        REASONS.swipe,
        event,
      ) as DrawerRoot.SnapPointChangeEventDetails;

      const settleInPlace = () => {
        // Reset nested swipe state now: the primitive's trailing progress update is deduped
        // when the drag never produced dismissal progress, so it may not fire.
        applySwipeProgress(0, true, true);
        clearSwipeRelease();
        return false;
      };

      const settleOnSnapPoint = (snapPoint: ResolvedDrawerSnapPoint) => {
        snap.setActiveSnapPoint(snapPoint.value, snapPointEventDetails);
        return settleInPlace();
      };

      const closeFromSnapPoints = (fallbackSnapPoint: ResolvedDrawerSnapPoint) => {
        // An unattributed gesture (e.g. a mostly horizontal flick) may settle on a snap
        // point but must not dismiss: the swipe primitive drops a directionless dismissal,
        // stranding the popup visually closed while `open` stays `true`.
        if (!direction) {
          return settleOnSnapPoint(fallbackSnapPoint);
        }
        snap.setActiveSnapPoint(null, snapPointEventDetails);
        if (snapPointEventDetails.isCanceled) {
          // A canceled null snap point rejects dismissal before exit styles start.
          return settleInPlace();
        }
        pendingSwipeCloseSnapPoint = activeSnapPoint;
        startSwipeRelease(swipeDirection);
        return true;
      };

      if (drawer.snapToSequentialPoints) {
        const orderedSnapPoints = [...resolvedSnapPoints].sort(
          (first, second) => first.offset - second.offset,
        );
        const orderedOffsets = orderedSnapPoints.map((point) => point.offset);
        const currentIndex = closestSnapPointIndex(orderedOffsets, currentOffset);
        let targetSnapPoint =
          orderedSnapPoints[closestSnapPointIndex(orderedOffsets, targetOffset)];

        const velocityDirection = Math.sign(resolvedDirectionalVelocity);
        const shouldAdvance =
          dragDirection !== 0 &&
          velocityDirection !== 0 &&
          velocityDirection === dragDirection &&
          Math.abs(resolvedDirectionalVelocity) >= SNAP_VELOCITY_THRESHOLD;
        let effectiveTargetOffset = targetOffset;

        if (shouldAdvance) {
          const adjacentIndex = clamp(
            currentIndex + dragDirection,
            0,
            orderedSnapPoints.length - 1,
          );
          if (adjacentIndex !== currentIndex) {
            const adjacentPoint = orderedSnapPoints[adjacentIndex];
            const shouldForceAdjacent =
              dragDirection > 0
                ? targetOffset < adjacentPoint.offset
                : targetOffset > adjacentPoint.offset;
            if (shouldForceAdjacent) {
              targetSnapPoint = adjacentPoint;
              effectiveTargetOffset = adjacentPoint.offset;
            }
          } else if (dragDirection > 0) {
            return closeFromSnapPoints(targetSnapPoint);
          }
        }

        const closeDistance = Math.abs(effectiveTargetOffset - popupHeight);
        const snapDistance = Math.abs(effectiveTargetOffset - targetSnapPoint.offset);
        if (closeDistance < snapDistance) {
          return closeFromSnapPoints(targetSnapPoint);
        }

        return settleOnSnapPoint(targetSnapPoint);
      }

      const closestSnapPoint =
        resolvedSnapPoints[
          closestSnapPointIndex(
            resolvedSnapPoints.map((point) => point.offset),
            targetOffset,
          )
        ];

      if (resolvedDirectionalVelocity >= FAST_SWIPE_VELOCITY && dragDelta > 0) {
        return closeFromSnapPoints(closestSnapPoint);
      }

      const closeDistance = Math.abs(targetOffset - popupHeight);
      if (closeDistance < Math.abs(targetOffset - closestSnapPoint.offset)) {
        return closeFromSnapPoints(closestSnapPoint);
      }

      return settleOnSnapPoint(closestSnapPoint);
    },
    onDismiss(event) {
      visualStateStore?.set({ swipeProgress: 0, frontmostHeight: 0 });

      const backdropElement = getBackdropElement();
      if (backdropElement) {
        backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
        backdropElement.style.removeProperty(DrawerPopupCssVars.height);
      }

      const dismissEventDetails = createChangeEventDetails(
        REASONS.swipe,
        event,
      ) as unknown as Parameters<typeof store.setOpen>[1];
      store.setOpen(false, dismissEventDetails);

      if (dismissEventDetails.isCanceled) {
        const pendingSnapPoint = pendingSwipeCloseSnapPoint;
        if (pendingSnapPoint !== undefined) {
          snap.setActiveSnapPoint(
            pendingSnapPoint,
            createChangeEventDetails(REASONS.swipe, event) as DrawerRoot.SnapPointChangeEventDetails,
          );
        }

        pendingSwipeCloseSnapPoint = undefined;
        swipe.reset();
        clearSwipeRelease();
        return;
      }

      // In controlled mode, the effective open state may not have changed yet (the `open` prop
      // takes precedence over the internal state and updates on the next flush). Proceed
      // optimistically with the dismiss animation, and check on the next frame whether the parent
      // accepted or rejected the close.
      if (store.select('open')) {
        const savedEvent = event;
        controlledDismissFrame.request(() => {
          if (store.select('open')) {
            // Parent rejected: revert animation and restore snap point.
            const pendingSnapPoint = pendingSwipeCloseSnapPoint;
            if (pendingSnapPoint !== undefined) {
              snap.setActiveSnapPoint(
                pendingSnapPoint,
                createChangeEventDetails(
                  REASONS.swipe,
                  savedEvent,
                ) as DrawerRoot.SnapPointChangeEventDetails,
              );
            }
            pendingSwipeCloseSnapPoint = undefined;
            clearSwipeRelease();
            swipe.reset();
          } else {
            // Parent accepted: clean up.
            pendingSwipeCloseSnapPoint = undefined;
          }
        });
        return;
      }

      pendingSwipeCloseSnapPoint = undefined;
      setSwipeDismissed(true);
    },
  });

  const swipePointerProps = swipe.pointerProps;
  const swipeTouchProps = swipe.touchProps;

  const touchListenerState = createMemo(
    () => ({
      rootElement: store.select('viewportElement') ?? store.select('popupElement'),
      active: open() && mounted(),
      nestedDrawerOpen: nestedDrawerOpen(),
      swipeDirection: drawer.swipeDirection,
    }),
    {
      equals: (a, b) =>
        a.rootElement === b.rootElement &&
        a.active === b.active &&
        a.nestedDrawerOpen === b.nestedDrawerOpen &&
        a.swipeDirection === b.swipeDirection,
    },
  );

  createEffect(touchListenerState, ({ rootElement, active, nestedDrawerOpen: nestedOpen, swipeDirection }) => {
    // A non-passive document listener makes all touch scrolling wait on the main thread.
    if (!rootElement || !active) {
      return undefined;
    }

    const resolvedRootElement: HTMLElement = rootElement;
    const axis: ScrollAxis =
      swipeDirection === 'left' || swipeDirection === 'right' ? 'horizontal' : 'vertical';
    const isVerticalScrollAxis = axis === 'vertical';

    const doc = ownerDocument(resolvedRootElement);
    function processTouchMove(event: TouchEvent, touchState: TouchScrollState, touch: Touch) {
      const drawerAxisDelta = isVerticalScrollAxis
        ? touch.clientY - touchState.lastY
        : touch.clientX - touchState.lastX;

      // Avoid blocking pinch zoom or text selection adjustments on iOS Safari.
      if (event.touches.length === 2) {
        return;
      }

      const allowTouchMove = shouldIgnoreSwipeForTextSelection(doc, resolvedRootElement);

      if (allowTouchMove || nestedOpen) {
        return;
      }

      if (shouldYieldTouchMove(touchState, event, touch, isVerticalScrollAxis)) {
        return;
      }

      const scrollTarget = touchState.scrollTarget;
      if (!scrollTarget || scrollTarget === doc.documentElement || scrollTarget === doc.body) {
        if (event.cancelable) {
          event.preventDefault();
        }
        // Claim the gesture before the delegated touch handlers see it.
        event.stopPropagation();
        swipe.moveNative(event, resolvedRootElement);
        return;
      }

      if (!hasScrollableContentOnAxis(scrollTarget, axis)) {
        // If the scroll container doesn't overflow on the drawer axis, prevent the window from
        // scrolling instead.
        if (event.cancelable) {
          event.preventDefault();
        }
        event.stopPropagation();
        return;
      }

      if (drawerAxisDelta !== 0) {
        const canSwipeFromScrollEdge = canSwipeFromScrollEdgeOnMove(
          scrollTarget,
          axis,
          swipeDirection,
          drawerAxisDelta,
        );

        if (!touchState.allowSwipe) {
          if (event.cancelable && canSwipeFromScrollEdge) {
            touchState.allowSwipe = true;
            event.preventDefault();
          } else {
            touchState.allowSwipe = false;
          }
        } else if (event.cancelable) {
          event.preventDefault();
        }
      }

      if (touchState.allowSwipe === true) {
        event.stopPropagation();
        swipe.moveNative(event, resolvedRootElement);
      }
    }

    function handleNativeTouchMove(event: TouchEvent) {
      // The virtual keyboard provider observes the move to tell a tap apart from a drag.
      // It must run even when the swipe gesture below claims the event with
      // `stopPropagation()`.
      virtualKeyboard?.onTouchMove(event);

      if (ignoreTouchSwipe) {
        return;
      }

      const touchState = touchScrollState;
      const touch = event.touches[0];
      if (!touch || !touchState) {
        return;
      }

      processTouchMove(event, touchState, touch);
      updateTouchScrollPosition(touchState, touch);
    }

    return addEventListener(doc, 'touchmove', handleNativeTouchMove, {
      passive: false,
      capture: true,
    });
  });

  createEffect(
    () =>
      [
        snapPointRange(),
        swipe.swiping(),
        open(),
        nested(),
        snapPointProgress(),
        drawer.frontmostHeight,
      ] as const,
    ([range, swiping, isOpen, isNested, progress]) => {
      if (!range || swiping) {
        return;
      }

      applySwipeProgress(!isOpen || isNested ? 0 : (progress ?? 0), true, false);
    },
  );

  if (notifyParentSwipeProgressChange) {
    createEffect(open, (isOpen) => {
      if (!isOpen) {
        notifyParentSwipeProgressChange(0);
      }

      return () => {
        notifyParentSwipeProgressChange(0);
      };
    });
  }

  const openMemo = createMemo(open);
  createEffect(openMemo, (isOpen) => {
    if (isOpen) {
      // Skip the swipe reset while `Drawer.SwipeArea` is driving the open: it zeroes the popup's
      // `--swipe-movement-*`, flashing it fully open for a frame. `clearSwipeRelease` doesn't
      // touch those vars, so always run it to clear any leftover release state from a prior
      // dismiss (e.g. when the popup is kept mounted).
      if (!drawer.swipeAreaActiveRef.current) {
        swipe.reset();
      }
      clearSwipeRelease();
    }
  });

  onSettled(() => {
    const backdropElement = getBackdropElement();

    return () => {
      visualStateStore?.set({ swipeProgress: 0, frontmostHeight: 0 });
      setBackdropSwipingAttribute(backdropElement, false);
      // `data-swiping` is set on whichever backdrop is current when a swipe starts, which can
      // differ from the captured element if the backdrop mounted late or changed identity.
      const currentBackdrop = getBackdropElement();
      if (currentBackdrop !== backdropElement) {
        setBackdropSwipingAttribute(currentBackdrop, false);
      }
      finishNestedSwipe();
    };
  });

  const swipeProviderValue: DrawerViewportContextValue = {
    get swiping() {
      return swipe.swiping();
    },
    getDragStyles: swipe.getDragStyles,
    get swipeStrength() {
      return swipeRelease() ?? null;
    },
    setSwipeDismissed,
  };

  function resetTouchSwipeState(ignoreSwipe: boolean) {
    ignoreTouchSwipe = ignoreSwipe;
    touchScrollState = null;
  }

  function resetTouchTrackingState() {
    resetTouchSwipeState(false);
    lastPointerType = '';
    ignoreNextTouchStartFromPen = false;
  }

  function handlePointerEnd(event: PointerEvent): boolean {
    lastPointerType = '';
    return event.pointerType !== 'touch';
  }

  function canHandleGesture() {
    return open() && mounted() && !nestedDrawerOpen();
  }

  const internalProps = {
    onPointerDown(event: PointerEvent) {
      lastPointerType = event.pointerType;
      ignoreNextTouchStartFromPen = event.pointerType === 'pen';

      if (!canHandleGesture()) {
        return;
      }

      const currentTarget = event.currentTarget as HTMLElement;
      const elementAtPoint = getElementAtPoint(
        currentTarget.getRootNode(),
        event.clientX,
        event.clientY,
      );
      // Pointer drags capture the pointer on press, so they can't wait to see which axis the
      // gesture takes; any `data-base-ui-swipe-ignore` value ignores them.
      if (isSwipeIgnoredTarget(elementAtPoint) || isDrawerContentTarget(elementAtPoint)) {
        return;
      }

      if (event.pointerType === 'touch') {
        return;
      }

      swipePointerProps.onPointerDown?.(event);
    },
    onPointerMove(event: PointerEvent) {
      if (event.pointerType === 'touch') {
        return;
      }

      swipePointerProps.onPointerMove?.(event);
    },
    onPointerUp(event: PointerEvent) {
      if (handlePointerEnd(event)) {
        swipePointerProps.onPointerUp?.(event);
      }
    },
    onPointerCancel(event: PointerEvent) {
      if (handlePointerEnd(event)) {
        swipePointerProps.onPointerCancel?.(event);
      }
    },
    onTouchStart(event: TouchEvent) {
      const startedFromPenPointerDown = lastPointerType === 'pen' && ignoreNextTouchStartFromPen;
      if (startedFromPenPointerDown) {
        ignoreNextTouchStartFromPen = false;
        resetTouchSwipeState(false);
        return;
      }

      if (!canHandleGesture()) {
        resetTouchSwipeState(false);
        return;
      }

      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      const rootElement = event.currentTarget as HTMLElement;
      if (isEventOnRangeInput(event, ownerWindow(rootElement))) {
        resetTouchSwipeState(false);
        return;
      }

      const elementAtPoint = getElementAtPoint(
        rootElement.getRootNode(),
        touch.clientX,
        touch.clientY,
      );
      const eventTarget = getTarget(event);
      const target = isElement(eventTarget) ? eventTarget : rootElement;
      if (!contains(rootElement, target)) {
        resetTouchSwipeState(true);
        return;
      }

      virtualKeyboard?.onTouchStart(event);

      const axis = scrollAxis();
      const crossScrollAxis: ScrollAxis = axis === 'vertical' ? 'horizontal' : 'vertical';

      // `x`/`y` hand touch drags along that axis to the element. Any value other than the
      // cross-axis one ignores the swipe outright; a cross-axis element is arbitrated like a
      // native cross-axis scroller below.
      if (
        closest(
          elementAtPoint,
          `${BASE_UI_SWIPE_IGNORE_SELECTOR}:not(${AXIS_SWIPE_IGNORE_SELECTORS[crossScrollAxis]})`,
        )
      ) {
        resetTouchSwipeState(true);
        return;
      }
      ignoreTouchSwipe = false;

      const scrollTarget = findScrollableTouchTarget(target, rootElement, axis);
      const hasCrossAxisGestureTarget =
        findScrollableTouchTarget(target, rootElement, crossScrollAxis) != null ||
        closest(elementAtPoint, AXIS_SWIPE_IGNORE_SELECTORS[crossScrollAxis]) != null;

      let allowSwipe: boolean | null = null;
      if (scrollTarget) {
        const canSwipeFromEdge = isAtSwipeStartEdge(scrollTarget, axis, drawer.swipeDirection);

        allowSwipe = canSwipeFromEdge ? null : false;
      }

      touchScrollState = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        startedInPopup: contains(getPopupElement(), elementAtPoint),
        scrollTarget,
        hasCrossAxisGestureTarget,
        allowSwipe,
        preserveNativeCrossAxisScroll: false,
        drawerAxisAttributed: false,
      };

      swipeTouchProps.onTouchStart?.(event);
    },
    onTouchEnd(event: TouchEvent) {
      virtualKeyboard?.onTouchEnd(event);
      resetTouchTrackingState();
      swipeTouchProps.onTouchEnd?.(event);
    },
    onTouchCancel(event: TouchEvent) {
      virtualKeyboard?.onTouchCancel();
      resetTouchTrackingState();
      swipeTouchProps.onTouchCancel?.(event);
    },
    // Drawer popups use drawer-specific nested state attributes.
    // Suppress DialogViewport's generic nested dialog attribute.
    [DialogViewportDataAttributes.nestedDialogOpen]: undefined,
  };

  const viewportProps = mergeProps(elementProps, internalProps);

  return (
    <DialogViewport
      render={componentProps.render}
      class={componentProps.class}
      style={componentProps.style}
      {...viewportProps}
    >
      <DrawerViewportContext value={swipeProviderValue}>{componentProps.children}</DrawerViewportContext>
    </DialogViewport>
  );
}

export interface DrawerViewportState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the drawer is nested within another drawer.
   */
  nested: boolean;
  /**
   * Whether the drawer has nested drawers open.
   */
  nestedDialogOpen: boolean;
}

export interface DrawerViewportProps extends BaseUIComponentProps<'div', DrawerViewportState> {}

export namespace DrawerViewport {
  export type Props = DrawerViewportProps;
  export type State = DrawerViewportState;
}

function setBackdropSwipingAttribute(backdropElement: HTMLElement | null, swiping: boolean) {
  backdropElement?.toggleAttribute(DrawerPopupDataAttributes.swiping, swiping);
}

function isSwipeIgnoredTarget(target: Element | null): boolean {
  return Boolean(closest(target, BASE_UI_SWIPE_IGNORE_SELECTOR));
}

function isDrawerContentTarget(target: Element | null): boolean {
  return Boolean(closest(target, DRAWER_CONTENT_SELECTOR));
}

function getBaseSwipeSize(element: HTMLElement, direction: SwipeDirection): number {
  return direction === 'left' || direction === 'right' ? element.offsetWidth : element.offsetHeight;
}

function getBaseSwipeThreshold(element: HTMLElement, direction: SwipeDirection): number {
  return Math.max(getBaseSwipeSize(element, direction) * 0.5, MIN_SWIPE_THRESHOLD);
}

function isRangeInput(
  target: EventTarget | null,
  win: ReturnType<typeof ownerWindow>,
): target is HTMLInputElement {
  return target instanceof win.HTMLInputElement && target.type === 'range';
}

function isTextSelectionControl(target: Element): target is HTMLInputElement | HTMLTextAreaElement {
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}

function hasExpandedSelectionWithinTarget(selection: Selection, target: Element): boolean {
  const anchorElement = isElement(selection.anchorNode)
    ? selection.anchorNode
    : selection.anchorNode?.parentElement;
  const focusElement = isElement(selection.focusNode)
    ? selection.focusNode
    : selection.focusNode?.parentElement;

  return (
    selection.containsNode(target, true) ||
    contains(target, anchorElement) ||
    contains(target, focusElement)
  );
}

function shouldIgnoreSwipeForTextSelection(doc: Document, rootElement: HTMLElement): boolean {
  const activeEl = activeElement(doc);
  if (activeEl && contains(rootElement, activeEl) && isTextSelectionControl(activeEl)) {
    const { selectionStart, selectionEnd } = activeEl as HTMLInputElement;
    if (selectionStart != null && selectionEnd != null && selectionStart < selectionEnd) {
      return true;
    }
  }

  const selection = doc.getSelection?.();
  if (!selection || selection.isCollapsed) {
    return false;
  }

  return hasExpandedSelectionWithinTarget(selection, rootElement);
}

function isEventOnRangeInput(event: TouchEvent, win: ReturnType<typeof ownerWindow>): boolean {
  return event.composedPath().some((pathTarget) => isRangeInput(pathTarget, win));
}

function updateTouchScrollPosition(touchState: TouchScrollState, touch: Touch): void {
  touchState.lastX = touch.clientX;
  touchState.lastY = touch.clientY;
}

/**
 * Arbitrates a touchmove between the drawer swipe and a cross-axis gesture: a native scroll, or an
 * element marked with the cross-axis `data-base-ui-swipe-ignore` value.
 * Returns `true` when the move must be left alone — either because the cross axis already won the
 * gesture, or because neither axis has passed the slop yet and the gesture cannot be attributed.
 */
function shouldYieldTouchMove(
  touchState: TouchScrollState,
  event: TouchEvent,
  touch: Touch,
  isVerticalScrollAxis: boolean,
): boolean {
  if (touchState.preserveNativeCrossAxisScroll) {
    return true;
  }

  // Attribution happens once per gesture.
  if (
    touchState.drawerAxisAttributed ||
    touchState.allowSwipe === true ||
    !touchState.hasCrossAxisGestureTarget
  ) {
    return false;
  }

  // A non-cancelable touchmove means the browser has already committed the gesture to a native
  // scroll; claiming it for the swipe would drag the popup alongside the scrolling content.
  if (!event.cancelable) {
    touchState.preserveNativeCrossAxisScroll = true;
    return true;
  }

  const drawerAxisGestureDelta = isVerticalScrollAxis
    ? touch.clientY - touchState.startY
    : touch.clientX - touchState.startX;
  const crossAxisGestureDelta = isVerticalScrollAxis
    ? touch.clientX - touchState.startX
    : touch.clientY - touchState.startY;
  const absDrawerAxisGestureDelta = Math.abs(drawerAxisGestureDelta);
  const absCrossAxisGestureDelta = Math.abs(crossAxisGestureDelta);

  if (
    absCrossAxisGestureDelta >= AXIS_LOCK_SLOP &&
    absCrossAxisGestureDelta > absDrawerAxisGestureDelta + AXIS_LOCK_BIAS
  ) {
    touchState.preserveNativeCrossAxisScroll = true;
    return true;
  }

  if (absDrawerAxisGestureDelta >= AXIS_LOCK_SLOP) {
    touchState.drawerAxisAttributed = true;
    return false;
  }

  // Neither axis has traveled past the slop yet, so the gesture cannot be attributed. Leave the
  // event alone: on iOS, `preventDefault()` on the first cancelable touchmove cancels native
  // scrolling for the entire gesture.
  return true;
}

function hasScrollableContentOnAxis(scrollTarget: HTMLElement, axis: ScrollAxis): boolean {
  return getScrollMetrics(scrollTarget, axis).max > 0;
}

function getScrollMetrics(scrollTarget: HTMLElement, axis: ScrollAxis) {
  if (axis === 'vertical') {
    const max = Math.max(0, scrollTarget.scrollHeight - scrollTarget.clientHeight);
    return { offset: scrollTarget.scrollTop, max };
  }

  const max = Math.max(0, scrollTarget.scrollWidth - scrollTarget.clientWidth);
  return { offset: scrollTarget.scrollLeft, max };
}

function isAtSwipeStartEdge(
  scrollTarget: HTMLElement,
  axis: ScrollAxis,
  direction: SwipeDirection,
): boolean {
  const dismissFromStartEdge = shouldDismissFromStartEdge(direction, axis);
  const { offset, max } = getScrollMetrics(scrollTarget, axis);
  return dismissFromStartEdge ? offset <= 0 : offset >= max;
}

function canSwipeFromScrollEdgeOnMove(
  scrollTarget: HTMLElement,
  axis: ScrollAxis,
  direction: SwipeDirection,
  delta: number,
): boolean {
  const dismissFromStartEdge = shouldDismissFromStartEdge(direction, axis);
  const movingTowardDismiss = dismissFromStartEdge ? delta > 0 : delta < 0;
  if (!movingTowardDismiss) {
    return false;
  }

  return isAtSwipeStartEdge(scrollTarget, axis, direction);
}

function shouldDismissFromStartEdge(direction: SwipeDirection, axis: ScrollAxis): boolean {
  return axis === 'vertical' ? direction === 'down' : direction === 'right';
}
