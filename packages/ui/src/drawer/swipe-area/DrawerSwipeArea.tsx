import { createEffect, createMemo, createSignal, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { clamp } from '@egoist/solid-base-utils/clamp';
import { NOOP } from '@egoist/solid-base-utils/empty';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { createSwipeDismiss, getDisplacement } from '../../utils/swipeDismiss';
import type { SwipeDirection } from '../../utils/swipeDismiss';
import { getElementTransform } from '../../utils/getElementTransform';
import * as DrawerPopupCssVars from '../popup/DrawerPopupCssVars';
import * as DrawerPopupDataAttributes from '../popup/DrawerPopupDataAttributes';
import * as DrawerBackdropCssVars from '../backdrop/DrawerBackdropCssVars';
import { useDrawerRootContext } from '../root/DrawerRootContext';
import type { DrawerSwipeDirection } from '../root/DrawerRootContext';
import { createBaseUiId } from '../../internals/baseUiId';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import { isVirtualClick } from '../../utils/popups/event';
import * as DrawerSwipeAreaDataAttributes from './DrawerSwipeAreaDataAttributes';

const DEFAULT_SWIPE_OPEN_RATIO = 0.5;
const MIN_SWIPE_START_DISTANCE = 1;
const VELOCITY_THRESHOLD = 0.1;
const FALLBACK_SWIPE_OPEN_THRESHOLD = 40;

const SWIPE_AREA_OPEN_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.open]: '',
};

const SWIPE_AREA_CLOSED_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.closed]: '',
};

const SWIPE_AREA_SWIPING_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.swiping]: '',
};

const SWIPE_AREA_DISABLED_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.disabled]: '',
};

const stateAttributesMapping: StateAttributesMapping<DrawerSwipeAreaState> = {
  open(value) {
    return value ? SWIPE_AREA_OPEN_HOOK : SWIPE_AREA_CLOSED_HOOK;
  },
  swiping(value) {
    return value ? SWIPE_AREA_SWIPING_HOOK : null;
  },
  swipeDirection(value) {
    return { [DrawerSwipeAreaDataAttributes.swipeDirection]: value };
  },
  disabled(value) {
    return value ? SWIPE_AREA_DISABLED_HOOK : null;
  },
};

const oppositeSwipeDirection: Record<DrawerSwipeDirection, DrawerSwipeDirection> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function resolveTouchAction(direction: DrawerSwipeDirection) {
  return direction === 'left' || direction === 'right' ? 'pan-y' : 'pan-x';
}

/**
 * An invisible area that listens for swipe gestures to open the drawer.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerSwipeArea(componentProps: DrawerSwipeArea.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'swipeDirection',
    'id',
  );

  const store = useDialogRootContext();
  const drawer = useDrawerRootContext();
  const providerContext = useDrawerProviderContext();

  const [swipeActive, setSwipeActive] = createSignal(false);
  const [swipeAreaElement, setSwipeAreaElement] = createSignal<HTMLElement | null>(null);

  let swipeAreaRef: HTMLElement | null = null;
  let swipeActiveValue = false;
  let swipeStartEvent: PointerEvent | TouchEvent | null = null;
  let openedBySwipe = false;
  const dragDelta = { x: 0, y: 0 };
  let closedOffset: number | null = null;
  let appliedSwipeStyles = false;
  let swipePopupElement: HTMLElement | null = null;
  let swipeBackdropElement: HTMLElement | null = null;
  let popupTransition: string | null = null;
  let releaseGuardCleanup: () => void = NOOP;

  const swipeAreaId = createBaseUiId(() => componentProps.id as string | undefined);

  // Registers the swipe area as a trigger of the drawer, so it counts as being inside the
  // popup's trigger set (e.g. outside-press and focus return checks).
  createEffect(
    () => [swipeAreaId(), swipeAreaElement()] as const,
    ([id, element]) => {
      if (!element || id === undefined) {
        return undefined;
      }
      const triggers = store.context.triggerElements;
      triggers.add(id, element);
      syncTriggerCount();
      return () => {
        if (triggers.getById(id) === element) {
          triggers.delete(id);
          syncTriggerCount();
        }
      };
    },
  );

  function syncTriggerCount() {
    const triggerCount = store.context.triggerElements.size;
    if (store.state.open && store.state.triggerCount !== triggerCount) {
      store.set('triggerCount', triggerCount);
    }
  }

  const open = () => store.select('open');
  const disabled = () => componentProps.disabled ?? false;

  const resolvedSwipeDirection = () =>
    componentProps.swipeDirection ?? oppositeSwipeDirection[drawer.swipeDirection];
  const dismissDirection = () => oppositeSwipeDirection[resolvedSwipeDirection()];
  const enabled = createMemo(() => !disabled() && (!open() || swipeActive()));

  function setSwipeActiveState(value: boolean) {
    swipeActiveValue = value;
    setSwipeActive(value);
  }

  function resetDragDelta() {
    dragDelta.x = 0;
    dragDelta.y = 0;
  }

  function disableDismissForSwipe() {
    releaseGuardCleanup();
    store.context.outsidePressEnabled = false;
  }

  function enableDismissAfterRelease() {
    releaseGuardCleanup();

    const doc = ownerDocument(swipeAreaRef);

    function restore(event?: MouseEvent) {
      // The gesture's trailing release click is the one physical click with no `pointerdown` of
      // its own. Ignore it and keep waiting, so it cannot dismiss the drawer it just opened,
      // while a click-only activation (keyboard or assistive tech) still re-enables in time.
      if (event?.type === 'click' && event.detail !== 0 && !isVirtualClick(event)) {
        return;
      }

      releaseGuardCleanup = NOOP;
      doc.removeEventListener('pointerdown', restore, true);
      doc.removeEventListener('click', restore, true);
      store.context.outsidePressEnabled = true;
    }

    // The pointerup that ends a swipe-open gesture synthesizes a `click`. When the drag released
    // outside the popup, that click would be treated as an outside press and immediately dismiss
    // the drawer that was just opened. Keep outside-press dismissal disabled until the next
    // interaction that isn't that release click.
    //
    // `restore` runs in document capture, ahead of the outside-press check (which happens on the
    // event target, after capture), so the triggering press still dismisses.
    releaseGuardCleanup = restore;
    doc.addEventListener('pointerdown', restore, true);
    doc.addEventListener('click', restore, true);
  }

  function getPopupSize(popupElement: HTMLElement) {
    const direction = dismissDirection();
    const isHorizontal = direction === 'left' || direction === 'right';
    const size = isHorizontal ? popupElement.offsetWidth : popupElement.offsetHeight;
    if (size <= 0) {
      return null;
    }

    return size;
  }

  function resolvePopupSize() {
    const popupElement = store.state.popupElement;
    return popupElement ? getPopupSize(popupElement) : null;
  }

  function resolveClosedOffset(popupElement: HTMLElement) {
    const offset = getPopupSize(popupElement);
    if (offset == null) {
      return null;
    }

    const direction = dismissDirection();
    const isHorizontal = direction === 'left' || direction === 'right';
    const transform = getElementTransform(popupElement);
    const transformOffset = isHorizontal ? transform.x : transform.y;
    if (Number.isFinite(transformOffset) && Math.abs(transformOffset) > 0.5) {
      return Math.min(offset, Math.abs(transformOffset));
    }

    return offset;
  }

  function resolveSwipeOpenThreshold() {
    const popupSize = resolvePopupSize();
    if (popupSize == null) {
      return FALLBACK_SWIPE_OPEN_THRESHOLD;
    }

    return popupSize * DEFAULT_SWIPE_OPEN_RATIO;
  }

  function applySwipeMovement() {
    untrack(() => {
      const popupElement = store.state.popupElement;
      if (!popupElement) {
        return;
      }

      if (!store.select('open') || !store.select('mounted')) {
        return;
      }

      if (closedOffset == null) {
        closedOffset = resolveClosedOffset(popupElement);
      }

      const resolvedClosedOffset = closedOffset;
      if (resolvedClosedOffset === null) {
        return;
      }

      const swipeDirection = resolvedSwipeDirection();
      const direction = dismissDirection();
      const frontmostHeight = drawer.frontmostHeight;
      const displacement = getDisplacement(swipeDirection, dragDelta.x, dragDelta.y);
      const clampedDisplacement = Math.max(0, displacement);
      const dampedDisplacement =
        clampedDisplacement > resolvedClosedOffset
          ? resolvedClosedOffset + Math.sqrt(clampedDisplacement - resolvedClosedOffset)
          : clampedDisplacement;
      const remaining = resolvedClosedOffset - dampedDisplacement;
      const directionSign = direction === 'left' || direction === 'up' ? -1 : 1;
      const movement = remaining * directionSign;
      const isHorizontal = direction === 'left' || direction === 'right';
      const movementX = isHorizontal ? movement : 0;
      const movementY = isHorizontal ? 0 : movement;
      const openProgress = clamp(clampedDisplacement / resolvedClosedOffset, 0, 1);
      const backdropProgress = clamp(1 - openProgress, 0, 1);

      popupElement.style.setProperty(DrawerPopupCssVars.swipeMovementX, `${movementX}px`);
      popupElement.style.setProperty(DrawerPopupCssVars.swipeMovementY, `${movementY}px`);
      popupElement.setAttribute(DrawerPopupDataAttributes.swiping, '');
      swipePopupElement = popupElement;
      if (popupTransition === null) {
        popupTransition = popupElement.style.transition;
      }
      popupElement.style.transition = 'none';

      const backdropElement = store.context.backdropElement;
      if (backdropElement) {
        backdropElement.setAttribute(DrawerPopupDataAttributes.swiping, '');
        swipeBackdropElement = backdropElement;
        backdropElement.style.setProperty(
          DrawerBackdropCssVars.swipeProgress,
          `${backdropProgress}`,
        );
        if (openProgress > 0 && frontmostHeight > 0) {
          backdropElement.style.setProperty(DrawerPopupCssVars.height, `${frontmostHeight}px`);
        } else {
          backdropElement.style.removeProperty(DrawerPopupCssVars.height);
        }
      }

      providerContext?.visualStateStore.set({
        swipeProgress: openProgress,
        frontmostHeight: openProgress > 0 ? frontmostHeight : 0,
      });
      appliedSwipeStyles = true;
      drawer.swipeAreaActiveRef.current = true;
    });
  }

  function clearSwipeStyles() {
    const popupElement = swipePopupElement;
    if (popupElement) {
      popupElement.style.removeProperty(DrawerPopupCssVars.swipeMovementX);
      popupElement.style.removeProperty(DrawerPopupCssVars.swipeMovementY);
      popupElement.removeAttribute(DrawerPopupDataAttributes.swiping);
    }

    if (popupElement && popupTransition !== null) {
      popupElement.style.transition = popupTransition;
      popupTransition = null;
    }

    const backdropElement = swipeBackdropElement;
    if (backdropElement) {
      backdropElement.removeAttribute(DrawerPopupDataAttributes.swiping);
      backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      backdropElement.style.removeProperty(DrawerPopupCssVars.height);
    }

    providerContext?.visualStateStore.set({ swipeProgress: 0, frontmostHeight: 0 });
    appliedSwipeStyles = false;
    swipePopupElement = null;
    swipeBackdropElement = null;
    drawer.swipeAreaActiveRef.current = false;
  }

  function openDrawer(event?: PointerEvent | TouchEvent) {
    openedBySwipe = true;
    store.setOpen(
      true,
      createChangeEventDetails(
        REASONS.swipe,
        event,
        swipeAreaRef ?? undefined,
      ) as unknown as Parameters<typeof store.setOpen>[1],
    );
  }

  function closeDrawer(event?: PointerEvent | TouchEvent) {
    store.setOpen(
      false,
      createChangeEventDetails(
        REASONS.swipe,
        event,
        swipeAreaRef ?? undefined,
      ) as unknown as Parameters<typeof store.setOpen>[1],
    );
  }

  function resetSwipeInteractionState() {
    swipeStartEvent = null;
    openedBySwipe = false;
    closedOffset = null;
    setSwipeActiveState(false);
  }

  function finishSwipeInteraction() {
    resetSwipeInteractionState();
    enableDismissAfterRelease();
    resetDragDelta();
    clearSwipeStyles();
  }

  const swipe = createSwipeDismiss({
    get enabled() {
      return enabled();
    },
    get directions() {
      return [resolvedSwipeDirection()];
    },
    element: () => swipeAreaRef,
    trackDrag: false,
    movementCssVars: {
      x: DrawerPopupCssVars.swipeMovementX,
      y: DrawerPopupCssVars.swipeMovementY,
    },
    onSwipeStart(event) {
      disableDismissForSwipe();
      swipeStartEvent = event;
      openedBySwipe = false;
      setSwipeActiveState(true);
      resetDragDelta();
    },
    onProgress(_progress, details) {
      if (!details) {
        return;
      }

      if (!swipeStartEvent) {
        return;
      }

      dragDelta.x = details.deltaX;
      dragDelta.y = details.deltaY;

      const swipeDirection = untrack(resolvedSwipeDirection);
      if (details.direction !== swipeDirection) {
        return;
      }

      const displacement = getDisplacement(swipeDirection, details.deltaX, details.deltaY);
      if (!openedBySwipe && displacement < MIN_SWIPE_START_DISTANCE) {
        return;
      }

      if (!openedBySwipe && !store.select('open')) {
        openDrawer(swipeStartEvent);
      }

      applySwipeMovement();
    },
    onRelease({ event, direction, deltaX, deltaY, releaseVelocityX, releaseVelocityY }) {
      const swipeDirection = resolvedSwipeDirection();
      const displacement = getDisplacement(swipeDirection, deltaX, deltaY);
      const releaseVelocity = getDisplacement(swipeDirection, releaseVelocityX, releaseVelocityY);
      const threshold = resolveSwipeOpenThreshold();
      const hasEnoughDistance = displacement >= threshold;
      const hasEnoughVelocity = releaseVelocity >= VELOCITY_THRESHOLD;
      const shouldOpen =
        direction === swipeDirection && (hasEnoughDistance || hasEnoughVelocity) && !disabled();

      if (shouldOpen) {
        if (!store.select('open')) {
          openDrawer(event);
        }
      } else if (openedBySwipe && store.select('open')) {
        closeDrawer(event);
      }

      finishSwipeInteraction();

      return false;
    },
    onCancel: finishSwipeInteraction,
  });

  const swipePointerProps = swipe.pointerProps;
  const swipeTouchProps = swipe.touchProps;

  // The change that opens the drawer re-renders the popup, resetting `--swipe-movement-*` to
  // `0px` (the viewport isn't swiping). Re-assert the swipe movement whenever the popup's
  // rendered state changes while the swipe area drives the gesture.
  createEffect(
    () => [store.select('open'), store.select('mounted'), store.select('popupElement')] as const,
    () => {
      if (swipeActiveValue && appliedSwipeStyles) {
        applySwipeMovement();
      }
    },
  );

  createEffect(enabled, (isEnabled) => {
    if (!isEnabled) {
      if (swipeActiveValue) {
        enableDismissAfterRelease();
      }
      swipe.reset();
      resetDragDelta();
      clearSwipeStyles();
      resetSwipeInteractionState();
    }
  });

  onCleanup(() => {
    releaseGuardCleanup();
    store.context.outsidePressEnabled = true;
  });

  const state: DrawerSwipeArea.State = {
    get open() {
      return open();
    },
    get swiping() {
      return swipe.swiping();
    },
    get swipeDirection() {
      return resolvedSwipeDirection();
    },
    get disabled() {
      return disabled();
    },
  };

  return renderElement('div', componentProps, {
    state,
    ref: (element: HTMLElement) => {
      swipeAreaRef = element;
      setSwipeAreaElement(element);
    },
    stateAttributesMapping,
    props: [
      {
        role: 'presentation',
        'aria-hidden': 'true',
        get style() {
          return {
            'pointer-events': !enabled() ? 'none' : undefined,
            'touch-action': resolveTouchAction(resolvedSwipeDirection()),
          } as JSX.CSSProperties;
        },
        onPointerDown(event: PointerEvent) {
          if (event.pointerType === 'touch') {
            return;
          }
          swipePointerProps.onPointerDown?.(event);

          // Prevent native text selection/drag gestures from competing with swipe-open dragging.
          if (event.cancelable) {
            event.preventDefault();
          }
        },
        onPointerMove(event: PointerEvent) {
          if (event.pointerType === 'touch') {
            return;
          }
          swipePointerProps.onPointerMove?.(event);
        },
        onPointerUp(event: PointerEvent) {
          if (event.pointerType === 'touch') {
            return;
          }
          swipePointerProps.onPointerUp?.(event);
        },
        onPointerCancel(event: PointerEvent) {
          if (event.pointerType === 'touch') {
            return;
          }
          swipePointerProps.onPointerCancel?.(event);
        },
        // The swipe handlers do nothing while the swipe area is disabled.
        ...swipeTouchProps,
        get id() {
          return swipeAreaId();
        },
      },
      elementProps,
    ],
  });
}

export interface DrawerSwipeAreaProps extends BaseUIComponentProps<'div', DrawerSwipeAreaState> {
  /**
   * Whether the swipe area is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The swipe direction that opens the drawer.
   * Defaults to the opposite of `Drawer.Root` `swipeDirection`.
   */
  swipeDirection?: DrawerSwipeDirection | undefined;
}

export interface DrawerSwipeAreaState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * Whether the swipe area is currently being swiped.
   */
  swiping: boolean;
  /**
   * The swipe direction that opens the drawer.
   */
  swipeDirection: SwipeDirection;
  /**
   * Whether the swipe area is disabled.
   */
  disabled: boolean;
}

export namespace DrawerSwipeArea {
  export type Props = DrawerSwipeAreaProps;
  export type State = DrawerSwipeAreaState;
}
