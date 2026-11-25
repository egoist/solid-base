import {
  createEffect,
  createMemo,
  createSignal,
  flush,
  omit,
  onCleanup,
  untrack,
  type Accessor,
  type Setter,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { activeElement, closest, contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import type { ToastObject as ToastObjectType } from '../useToastManager';
import { ToastRootContext } from './ToastRootContext';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { renderElement } from '../../internals/renderElement';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import {
  BASE_UI_SWIPE_IGNORE_SELECTOR,
  LEGACY_SWIPE_IGNORE_SELECTOR,
} from '../../internals/constants';
import {
  applyDirectionalDamping,
  getDismissDirection,
  getDisplacement,
  shouldCancelReverseSwipe,
  updateSwipeCancelBaseline,
} from '../../utils/swipeDismiss';
import { getElementTransform } from '../../utils/getElementTransform';
import * as ToastRootCssVars from './ToastRootCssVars';
import * as ToastRootDataAttributes from './ToastRootDataAttributes';

export const toastRootStateAttributesMapping: StateAttributesMapping<ToastRootState> = {
  ...transitionStatusMapping,
  swipeDirection(value) {
    return value ? { [ToastRootDataAttributes.swipeDirection]: value } : null;
  },
};

type SwipeDirection = 'up' | 'down' | 'left' | 'right';

const SWIPE_THRESHOLD = 40;
const MIN_DRAG_THRESHOLD = 1;
const TOAST_SWIPE_IGNORE_SELECTOR = `${BASE_UI_SWIPE_IGNORE_SELECTOR},${LEGACY_SWIPE_IGNORE_SELECTOR}`;
const DEFAULT_SWIPE_DIRECTIONS: SwipeDirection[] = ['down', 'right'];

/**
 * Groups all parts of an individual toast.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastRoot(componentProps: ToastRoot.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'toast', 'swipeDirection');

  const store = useToastProviderContext();

  const toast = () => componentProps.toast;

  const swipeDirections = createMemo(
    (): SwipeDirection[] => {
      const isAnchored = toast().positionerProps?.anchor !== undefined;
      if (isAnchored) {
        return [];
      }
      const swipeDirection = componentProps.swipeDirection ?? DEFAULT_SWIPE_DIRECTIONS;
      return Array.isArray(swipeDirection) ? swipeDirection : [swipeDirection];
    },
    { name: 'ToastRoot.swipeDirections', equals: areArraysEqual },
  );

  const swipeEnabled = () => swipeDirections().length > 0;

  const [currentSwipeDirection, setCurrentSwipeDirection] = createSignal<
    SwipeDirection | undefined
  >(undefined);
  const [isSwiping, setIsSwiping] = createSignal(false);
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 });
  const [initialTransform, setInitialTransform] = createSignal({ x: 0, y: 0, scale: 1 });
  const [titleIdSources, setTitleIdSources] = createSignal<Array<Accessor<string | undefined>>>(
    [],
    { name: 'ToastRoot.titleIdSources' },
  );
  const [descriptionIdSources, setDescriptionIdSources] = createSignal<
    Array<Accessor<string | undefined>>
  >([], { name: 'ToastRoot.descriptionIdSources' });
  // The latest registered part that renders something labels (or describes) the toast.
  const titleId = createMemo(() => resolveRegisteredId(titleIdSources()), {
    name: 'ToastRoot.titleId',
  });
  const descriptionId = createMemo(() => resolveRegisteredId(descriptionIdSources()), {
    name: 'ToastRoot.descriptionId',
  });

  function createIdRegistration(setSources: Setter<Array<Accessor<string | undefined>>>) {
    return (id: Accessor<string | undefined>) => {
      setSources((sources) => [...sources, id]);
      return () => {
        setSources((sources) => sources.filter((source) => source !== id));
      };
    };
  }
  const [rootElement, setRootElement] = createSignal<HTMLElement | null>(null);

  // Imperative swipe bookkeeping, read and written by the pointer handlers only.
  const rootRef: RefObject<HTMLElement | null> = { current: null };
  let initialized = false;
  let isRealSwipe = false;
  let lockedDirection: 'horizontal' | 'vertical' | null = null;
  let dragStartPos = { x: 0, y: 0 };
  let initialTransformValue = { x: 0, y: 0, scale: 1 };
  let intendedSwipeDirection: SwipeDirection | undefined;
  let maxSwipeDisplacement = 0;
  let cancelledSwipe = false;
  let swipeCancelBaseline = { x: 0, y: 0 };
  let isFirstPointerMove = false;
  let dragOffsetValue = { x: 0, y: 0 };
  let activePointerId: number | null = null;
  let dragAbortController: AbortController | null = null;

  const domIndex = () => store.select('toastIndex', toast().id);
  const visibleIndex = () => store.select('toastVisibleIndex', toast().id);
  const offsetY = () => store.select('toastOffsetY', toast().id);
  const focused = () => store.select('focused');
  const expanded = () => store.select('expanded');

  function setRootRef(element: HTMLElement) {
    rootRef.current = element;
    setRootElement(element);
  }

  onCleanup(() => {
    rootRef.current = null;
    dragAbortController?.abort();
  });

  createOpenChangeComplete({
    open: () => toast().transitionStatus !== 'ending',
    element: rootElement,
    onComplete() {
      untrack(() => {
        if (toast().transitionStatus === 'ending') {
          store.removeToast(toast().id);
        }
      });
    },
  });

  // Recalculates the natural height of the toast and updates it in the toast manager.
  // `flushSync` avoids visual flickers when called from observer callbacks.
  // The store ignores this write while the toast is transitioning out.
  function recalculateHeight(flushSync: boolean = false) {
    const element = rootRef.current;
    if (!element) {
      return;
    }

    const previousHeight = element.style.height;
    element.style.height = 'auto';

    const height = element.offsetHeight;

    element.style.height = previousHeight;

    untrack(() => {
      store.updateToastInternal(toast().id, {
        ref: rootRef,
        height,
        transitionStatus: undefined,
      });
    });

    if (flushSync) {
      flush();
    }
  }

  function setResolvedDragOffset(nextDragOffset: { x: number; y: number }) {
    dragOffsetValue = nextDragOffset;
    setDragOffset(nextDragOffset);
  }

  // A toast begins a lifecycle when the root mounts, when a non-keyed list hands the root a
  // different toast, and when an ending toast is re-added under the same id (the list keeps the
  // root instance, since it keeps the toast's identity by id). The lifecycle counts the entries
  // into `starting` rather than tracking the status itself: the measurement below clears
  // `starting`, and must not re-trigger itself.
  const toastId = createMemo(() => toast().id, { name: 'ToastRoot.toastId' });
  const isStarting = createMemo(() => toast().transitionStatus === 'starting', {
    name: 'ToastRoot.isStarting',
  });
  const startCount = createMemo((previous: number = 0) => (isStarting() ? previous + 1 : previous), {
    name: 'ToastRoot.startCount',
  });

  // Measure the toast at the start of each lifecycle.
  createEffect(
    () => [toastId(), startCount()],
    () => {
      if (initialized) {
        // A retained root keeps component-local swipe state from its previous lifecycle;
        // clear it so the toast doesn't stay offset or exit in the swiped direction.
        setCurrentSwipeDirection(undefined);
        initialTransformValue = { x: 0, y: 0, scale: 1 };
        setInitialTransform(initialTransformValue);
        setResolvedDragOffset({ x: 0, y: 0 });
      }

      initialized = true;
      recalculateHeight();
    },
    { name: 'ToastRoot.measureLifecycle' },
  );

  function handleSwipeEnd(event: PointerEvent) {
    if (event.pointerId !== activePointerId) {
      return;
    }

    activePointerId = null;
    dragAbortController?.abort();
    dragAbortController = null;
    setIsSwiping(false);
    isRealSwipe = false;
    lockedDirection = null;

    const resolvedInitialTransform = initialTransformValue;
    const resolvedDragOffset = dragOffsetValue;
    const deltaX = resolvedDragOffset.x - resolvedInitialTransform.x;
    const deltaY = resolvedDragOffset.y - resolvedInitialTransform.y;
    const dismissDirection =
      event.type === 'pointercancel' || cancelledSwipe
        ? undefined
        : getDismissDirection(swipeDirections(), deltaX, deltaY, SWIPE_THRESHOLD);

    if (dismissDirection) {
      setCurrentSwipeDirection(dismissDirection);
      store.closeToast(toast().id);
    } else {
      setResolvedDragOffset({ x: resolvedInitialTransform.x, y: resolvedInitialTransform.y });
      setCurrentSwipeDirection(undefined);
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (!swipeEnabled() || event.button !== 0) {
      return;
    }

    if (event.pointerType === 'touch') {
      store.pauseTimers();
    }

    const target = getTarget(event) as HTMLElement | null;

    const isInteractiveElement = closest(
      target,
      `button,a,input,textarea,[role="button"],${TOAST_SWIPE_IGNORE_SELECTOR}`,
    );

    if (isInteractiveElement) {
      return;
    }

    const element = rootRef.current;
    if (!element) {
      return;
    }

    cancelledSwipe = false;
    intendedSwipeDirection = undefined;
    maxSwipeDisplacement = 0;
    activePointerId = event.pointerId;
    dragStartPos = { x: event.clientX, y: event.clientY };
    swipeCancelBaseline = dragStartPos;

    const transform = getElementTransform(element);
    initialTransformValue = transform;
    setInitialTransform(transform);
    setResolvedDragOffset({
      x: transform.x,
      y: transform.y,
    });

    store.set('hovering', true);
    setIsSwiping(true);
    isRealSwipe = false;
    lockedDirection = null;
    isFirstPointerMove = true;

    dragAbortController?.abort();
    const abortController = new AbortController();
    dragAbortController = abortController;

    const doc = ownerDocument(element);
    doc.addEventListener('pointerup', handleSwipeEnd, { signal: abortController.signal });
    doc.addEventListener('pointercancel', handleSwipeEnd, { signal: abortController.signal });

    try {
      element.setPointerCapture?.(event.pointerId);
    } catch (error) {
      if (!(error && typeof error === 'object' && 'name' in error && error.name === 'NotFoundError')) {
        throw error;
      }
    }
  }

  function handlePointerMove(event: PointerEvent) {
    if (!swipeEnabled() || event.pointerId !== activePointerId) {
      return;
    }

    // Prevent text selection on Safari
    event.preventDefault();

    if (isFirstPointerMove) {
      // Adjust the starting position to the current position on the first move
      // to account for the delay between pointerdown and the first pointermove on iOS.
      dragStartPos = { x: event.clientX, y: event.clientY };
      isFirstPointerMove = false;
    }

    const { clientY, clientX, movementX, movementY } = event;
    const directions = swipeDirections();

    swipeCancelBaseline = updateSwipeCancelBaseline(
      swipeCancelBaseline,
      { x: clientX, y: clientY },
      { x: movementX, y: movementY },
    );

    const deltaX = clientX - dragStartPos.x;
    const deltaY = clientY - dragStartPos.y;
    const cancelDeltaY = clientY - swipeCancelBaseline.y;
    const cancelDeltaX = clientX - swipeCancelBaseline.x;

    const hasHorizontal = directions.includes('left') || directions.includes('right');
    const hasVertical = directions.includes('up') || directions.includes('down');

    if (!isRealSwipe && Math.hypot(deltaX, deltaY) >= MIN_DRAG_THRESHOLD) {
      isRealSwipe = true;
      // Locking is only meaningful when both axes are swipeable; otherwise the single axis
      // already constrains the gesture.
      if (hasHorizontal && hasVertical) {
        lockedDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
      }
    }

    if (!intendedSwipeDirection) {
      let candidate: SwipeDirection | undefined;
      if (lockedDirection === 'vertical') {
        if (deltaY !== 0) {
          candidate = deltaY > 0 ? 'down' : 'up';
        }
      } else if (lockedDirection === 'horizontal') {
        if (deltaX !== 0) {
          candidate = deltaX > 0 ? 'right' : 'left';
        }
      } else if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        candidate = deltaX > 0 ? 'right' : 'left';
      } else {
        candidate = deltaY > 0 ? 'down' : 'up';
      }

      if (candidate && directions.includes(candidate)) {
        intendedSwipeDirection = candidate;
        maxSwipeDisplacement = getDisplacement(candidate, deltaX, deltaY);
        setCurrentSwipeDirection(candidate);
      }
    } else {
      const direction = intendedSwipeDirection;
      const currentDisplacement = getDisplacement(direction, cancelDeltaX, cancelDeltaY);

      if (currentDisplacement > SWIPE_THRESHOLD) {
        cancelledSwipe = false;
        setCurrentSwipeDirection(direction);
      } else if (shouldCancelReverseSwipe(directions, maxSwipeDisplacement, currentDisplacement)) {
        // Mark that a change-of-mind has occurred
        cancelledSwipe = true;
      }
    }

    const dampedDelta = applyDirectionalDamping(deltaX, deltaY, directions);
    let newOffsetX = initialTransformValue.x;
    let newOffsetY = initialTransformValue.y;

    if (lockedDirection !== 'vertical' && hasHorizontal) {
      newOffsetX += dampedDelta.x;
    }

    if (lockedDirection !== 'horizontal' && hasVertical) {
      newOffsetY += dampedDelta.y;
    }

    setResolvedDragOffset({ x: newOffsetX, y: newOffsetY });
  }

  function handlePointerUp(event: PointerEvent) {
    if (swipeEnabled()) {
      handleSwipeEnd(event);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      const element = rootRef.current;
      if (!element || !contains(element, activeElement(ownerDocument(element)))) {
        return;
      }

      store.closeToast(toast().id);
    }
  }

  createEffect(
    () => (swipeEnabled() ? rootElement() : null),
    (element) => {
      if (!element) {
        return undefined;
      }

      function preventDefaultTouchStart(event: TouchEvent) {
        if (activePointerId === null || !contains(element, getTarget(event) as HTMLElement | null)) {
          return;
        }

        // A pointermove `preventDefault` is not enough on iOS; this
        // non-passive touchmove listener blocks native scrolling while dragging.
        event.preventDefault();
      }

      return addEventListener(element, 'touchmove', preventDefaultTouchStart, { passive: false });
    },
  );

  const isHighPriority = () => toast().priority === 'high';

  const defaultProps: HTMLProps = {
    get role() {
      return isHighPriority() ? 'alertdialog' : 'dialog';
    },
    tabindex: 0,
    'aria-modal': 'false',
    get 'aria-labelledby'() {
      return titleId();
    },
    get 'aria-describedby'() {
      return descriptionId();
    },
    get 'aria-hidden'() {
      return isHighPriority() && !focused() ? 'true' : undefined;
    },
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
    onKeyDown: handleKeyDown,
    get inert() {
      return toast().limited ? true : undefined;
    },
    get style() {
      const offset = dragOffset();
      const initial = initialTransform();
      const swiping = isSwiping();
      const height = toast().height;
      const style: JSX.CSSProperties = {
        [ToastRootCssVars.swipeMovementX]: `${offset.x - initial.x}px`,
        [ToastRootCssVars.swipeMovementY]: `${offset.y - initial.y}px`,
        [ToastRootCssVars.index]: String(
          toast().transitionStatus === 'ending' ? domIndex() : visibleIndex(),
        ),
        [ToastRootCssVars.offsetY]: `${offsetY()}px`,
      };
      if (swiping) {
        // While swiping, freeze the element at its current visual transform so it doesn't snap
        // to the end position.
        style.transition = 'none';
        style.transform = `translateX(${offset.x}px) translateY(${offset.y}px) scale(${initial.scale})`;
      }
      if (height) {
        style[ToastRootCssVars.height] = `${height}px`;
      }
      return style;
    },
  };

  const context: ToastRootContext = {
    get toast() {
      return toast();
    },
    registerTitleId: createIdRegistration(setTitleIdSources),
    registerDescriptionId: createIdRegistration(setDescriptionIdSources),
    recalculateHeight,
    get visibleIndex() {
      return visibleIndex();
    },
    get expanded() {
      return expanded();
    },
  };

  const state: ToastRoot.State = {
    get transitionStatus() {
      return toast().transitionStatus;
    },
    get expanded() {
      return expanded();
    },
    get limited() {
      return toast().limited || false;
    },
    get type() {
      return toast().type;
    },
    get swiping() {
      return isSwiping();
    },
    get swipeDirection() {
      return currentSwipeDirection();
    },
  };

  return (
    <ToastRootContext value={context}>
      {renderElement('div', componentProps, {
        ref: setRootRef,
        state,
        stateAttributesMapping: toastRootStateAttributesMapping,
        props: [defaultProps, elementProps],
      })}
    </ToastRootContext>
  );
}

function resolveRegisteredId(sources: Array<Accessor<string | undefined>>) {
  for (let index = sources.length - 1; index >= 0; index -= 1) {
    const id = sources[index]();
    if (id !== undefined) {
      return id;
    }
  }
  return undefined;
}

function areArraysEqual<T>(a: readonly T[], b: readonly T[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export type ToastRootToastObject<Data extends object = any> = ToastObjectType<Data>;

export interface ToastRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the toasts in the viewport are expanded.
   */
  expanded: boolean;
  /**
   * Whether the toast was limited because the toast limit was exceeded.
   */
  limited: boolean;
  /**
   * The type of the toast.
   */
  type: string | undefined;
  /**
   * Whether the toast is being swiped.
   */
  swiping: boolean;
  /**
   * The direction the toast is being swiped.
   */
  swipeDirection: SwipeDirection | undefined;
}

export interface ToastRootProps extends BaseUIComponentProps<'div', ToastRootState> {
  /**
   * The toast to render.
   */
  toast: ToastRootToastObject<any>;
  /**
   * Direction(s) in which the toast can be swiped to dismiss.
   * @default ['down', 'right']
   */
  swipeDirection?: SwipeDirection | SwipeDirection[] | undefined;
}

export namespace ToastRoot {
  export type ToastObject<Data extends object = any> = ToastRootToastObject<Data>;
  export type State = ToastRootState;
  export type Props = ToastRootProps;
}
