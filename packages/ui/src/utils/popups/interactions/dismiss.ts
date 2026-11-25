import { createEffect, createMemo, onCleanup } from 'solid-js';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { mergeCleanups } from '@egoist/solid-base-utils/mergeCleanups';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { Timeout, createTimeout } from '@egoist/solid-base-utils/timeout';
import {
  getComputedStyle,
  getParentNode,
  isElement,
  isHTMLElement,
  isLastTraversableNode,
  isShadowRoot,
} from '@floating-ui/utils/dom';
import { platform } from '@egoist/solid-base-utils/platform';
import { contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { useFloatingTree } from '../tree/FloatingTree';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import type { ElementProps, PopupInteractionStore } from '../types';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import type { FloatingUIOpenChangeDetails } from '../../../internals/types';
import { REASONS } from '../../../internals/reasons';
import { createAttribute } from '../createAttribute';
import { isEventInsideComponentTree, isEventTargetWithin, isRootElement } from '../element';
import { isVirtualClick } from '../event';
import { getNodeChildren } from '../tree/nodes';

type PressType = 'intentional' | 'sloppy';

// Floating elements number themselves when they open, which reaches parents before their
// children. An Escape that reaches the document (focus is on `body` after a backdrop press, for
// example) bypasses the floating elements' own `onKeyDown` handlers, and `stopPropagation()` can't
// stop the other document listeners. So each open floating element records its number for the
// event in the capture phase, and the newest one that doesn't let Escape bubble handles it, along
// with any newer ones that do.
let openCount = 0;
const escapeLayers = new WeakMap<Event, number>();
// The same numbering decides who owns a press: a press inside a floating element opened after this
// one (a modal Dialog that isn't nested in its component tree, for example) belongs to that layer,
// so it isn't an outside press here.
const pressLayers = new WeakMap<Event, number>();

export function normalizeProp(
  normalizable?: boolean | { escapeKey?: boolean | undefined; outsidePress?: boolean | undefined },
) {
  return {
    escapeKey:
      typeof normalizable === 'boolean' ? normalizable : (normalizable?.escapeKey ?? false),
    outsidePress:
      typeof normalizable === 'boolean' ? normalizable : (normalizable?.outsidePress ?? true),
  };
}

export type OutsidePressEvent =
  | PressType
  | { mouse: PressType; touch: PressType }
  | (() => PressType | { mouse: PressType; touch: PressType });

export interface CreateDismissOptions {
  /**
   * Whether the interaction is enabled, including all internal effects and event handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Whether to dismiss the floating element upon pressing the `esc` key.
   * @default true
   */
  escapeKey?: boolean | undefined;
  /**
   * Whether to dismiss the floating element upon pressing the reference element.
   * A lazy getter invoked when handling reference press events.
   * @default () => false
   */
  referencePress?: (() => boolean) | undefined;
  /**
   * Whether to dismiss the floating element upon pressing outside of it.
   * A function can guard the check:
   * ```ts
   * createDismiss(store, { outsidePress: (event) => !event.target.closest('.toast') });
   * ```
   * @default true
   */
  outsidePress?: boolean | ((event: MouseEvent | TouchEvent) => boolean) | undefined;
  /**
   * The type of event to use to determine an outside "press".
   * - `intentional` dismisses on an outside `click` whose press began while the floating element
   *   was open, ignoring the trailing click of a press that started before it opened. Touch
   *   requires minimal `touchmove`s, and press-less clicks (keyboard, assistive technology) are
   *   always accepted.
   * - `sloppy` fires on `pointerdown` for mouse, while for touch it fires on `touchend` (within
   *   1 second) or while scrolling away after `touchstart`.
   * @default 'sloppy'
   */
  outsidePressEvent?: OutsidePressEvent | undefined;
  /**
   * Determines whether event listeners bubble upwards through a tree of floating elements.
   * `escapeKey` also determines whether an Escape that reaches the document, rather than a
   * floating element, propagates to floating elements opened earlier, even when they share no
   * `FloatingTree`.
   */
  bubbles?:
    boolean | { escapeKey?: boolean | undefined; outsidePress?: boolean | undefined } | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
}

/**
 * Closes the floating element when a dismissal is requested — by default, when the user presses
 * the `esc` key or outside of the floating element.
 *
 * Options are read lazily (pass getters for reactive values). Returns props for the `reference`
 * (active trigger), `trigger` (inactive triggers) and `floating` (popup) elements.
 */
export function createDismiss(
  store: PopupInteractionStore,
  options: CreateDismissOptions = {},
): ElementProps {
  const enabled = () => options.enabled ?? true;
  const escapeKey = () => options.escapeKey ?? true;
  const outsidePressOption = () => options.outsidePress ?? true;
  const bubbles = () => normalizeProp(options.bubbles);

  const storeContext = store.context;
  const { events } = storeContext;

  const tree = useFloatingTree(options.externalTree);

  let pressStartedInside = false;
  let pressStartPrevented = false;
  // The press-start events of the current inside press. Solid's delegated handlers (the
  // floating element's children's `onPointerDown`) run on the document, after the floating
  // element's own bubble listeners, so `defaultPrevented` is also read again when the press ends.
  let pressStartEvents: Event[] = [];
  // Ignore only the very next outside click after dragging from inside to outside.
  let suppressNextOutsideClick = false;
  // A click whose press began before the floating element opened is the tail of that gesture
  // (e.g. the drag-release that opened it), not a new outside press.
  let sawPressWhileOpen = false;
  let compositionEndPending = false;
  let currentPointerType = '';
  let layer = 0;

  let touchState: {
    startTime: number;
    startX: number;
    startY: number;
    dismissOnTouchEnd: boolean;
    dismissOnMouseDown: boolean;
  } | null = null;

  const cancelDismissOnEndTimeout = createTimeout();
  const clearInsideReactTreeTimeout = createTimeout();
  // Outlives effect re-runs so a pending reset can't leave `compositionEndPending` stuck.
  const compositionTimeout = createTimeout();

  function clearInsideReactTree() {
    clearInsideReactTreeTimeout.clear();
    storeContext.insideReactTree = false;
  }

  function hasBlockingChild(bubbleKey: 'escapeKeyBubbles' | 'outsidePressBubbles') {
    const nodeId = storeContext.positioning?.nodeId;
    const children = tree ? getNodeChildren(tree.nodesRef.current, nodeId) : [];

    return children.some(
      (child) => child.context?.open && !child.context.rootStore.context[bubbleKey],
    );
  }

  function isEventWithinOwnElements(event: Event) {
    return (
      isEventTargetWithin(event, store.select('positionerElement')) ||
      isEventTargetWithin(event, store.select('anchorElement'))
    );
  }

  function closeOnReferencePress(event: MouseEvent | PointerEvent) {
    if (!enabled() || !(options.referencePress?.() ?? false)) {
      return;
    }

    store.setOpen(false, createChangeEventDetails(REASONS.triggerPress, event));
  }

  function closeOnEscapeKeyDown(event: KeyboardEvent) {
    if (!store.select('open') || !enabled() || !escapeKey() || event.key !== 'Escape') {
      return;
    }

    // Key code 229 indicates that an IME is processing the key event.
    const isImeKey = event.keyCode === 229;

    // Wait until IME is settled. Pressing `Escape` while composing should close the compose menu,
    // but not the floating element. The flag covers Safari, which fires `compositionend` before
    // `keydown`; the native event identifies an active composition.
    if (compositionEndPending || event.isComposing || isImeKey) {
      return;
    }

    const escapeKeyBubbles = bubbles().escapeKey;

    if (!escapeKeyBubbles && hasBlockingChild('escapeKeyBubbles')) {
      return;
    }

    const eventDetails = createChangeEventDetails(REASONS.escapeKey, event);

    store.setOpen(false, eventDetails);

    if (!eventDetails.isCanceled) {
      event.preventDefault();
    }

    if (!escapeKeyBubbles && !eventDetails.isPropagationAllowed) {
      event.stopPropagation();
    }
  }

  function markInsideReactTree() {
    storeContext.insideReactTree = true;
    clearInsideReactTreeTimeout.start(0, clearInsideReactTree);
  }

  function markPressStartedInsideReactTree(event: PointerEvent | MouseEvent) {
    if (!store.select('open') || !enabled() || event.button !== 0) {
      return;
    }

    const target = getTarget(event) as Element | null;

    // Only treat presses that start within the floating DOM subtree as inside.
    // This avoids suppressing parent dismissal when interacting with nested portals.
    if (!contains(store.select('positionerElement'), target)) {
      return;
    }

    if (!pressStartedInside) {
      pressStartedInside = true;
      pressStartPrevented = false;
      pressStartEvents = [];
    }

    pressStartEvents.push(event);
  }

  function markInsidePressStartPrevented(event: PointerEvent | MouseEvent) {
    if (!store.select('open') || !enabled()) {
      return;
    }

    if (!event.defaultPrevented) {
      return;
    }

    if (pressStartedInside) {
      pressStartPrevented = true;
    }
  }

  // A close+reopen in the same batch never renders `open === false`, so only `openchange` can
  // observe that session boundary.
  function handleOpenChange(details: FloatingUIOpenChangeDetails) {
    // Only the closing half ends the session: `setOpen(true)` on an already-open element
    // (hovering an inactive trigger) must not drop a press mid-gesture.
    if (!details.open) {
      sawPressWhileOpen = false;
    }
  }
  events.on('openchange', handleOpenChange);
  onCleanup(() => {
    events.off('openchange', handleOpenChange);
    clearInsideReactTree();
  });

  // This popup's open number orders Escape and outside-press ownership (see `openCount`).
  // Effects never compare their values, so the open state goes through a memo: a controlled
  // `open` accessor that re-evaluates to the same value must not renumber the popup or
  // re-attach the listeners mid-gesture.
  const open = createMemo(() => store.select('open'));
  createEffect(open, (isOpen) => {
    if (isOpen) {
      openCount += 1;
      layer = openCount;
    } else {
      layer = 0;
    }
  });

  // Capture-phase markers on the floating element. React's synthetic capture handlers also see
  // presses in portaled children; those are recognized through the component tree instead (see
  // `isEventInsideComponentTree` below).
  createEffect(
    () => (enabled() ? store.select('positionerElement') : null),
    (floating) => {
      if (!floating) {
        return undefined;
      }
      function onPressCapture(event: Event) {
        markInsideReactTree();
        markPressStartedInsideReactTree(event as PointerEvent);
      }
      return mergeCleanups(
        addEventListener(floating, 'click', markInsideReactTree, true),
        addEventListener(floating, 'mousedown', onPressCapture, true),
        addEventListener(floating, 'pointerdown', onPressCapture, true),
        addEventListener(floating, 'mouseup', markInsideReactTree, true),
        addEventListener(floating, 'touchend', markInsideReactTree, {
          capture: true,
          passive: true,
        }),
        addEventListener(floating, 'touchmove', markInsideReactTree, {
          capture: true,
          passive: true,
        }),
        addEventListener(floating, 'pointerdown', markInsidePressStartPrevented),
        addEventListener(floating, 'mousedown', markInsidePressStartPrevented),
      );
    },
  );

  const listenerDeps = createMemo(
    () => ({
      open: open(),
      enabled: enabled(),
      positionerElement: store.select('positionerElement'),
      escapeKey: escapeKey(),
      outsidePressEnabled: outsidePressOption() !== false,
      bubbles: bubbles(),
    }),
    {
      equals: (a, b) =>
        a.open === b.open &&
        a.enabled === b.enabled &&
        a.positionerElement === b.positionerElement &&
        a.escapeKey === b.escapeKey &&
        a.outsidePressEnabled === b.outsidePressEnabled &&
        a.bubbles.escapeKey === b.bubbles.escapeKey &&
        a.bubbles.outsidePress === b.bubbles.outsidePress,
    },
  );

  createEffect(
    listenerDeps,
    ({
      open,
      enabled: isEnabled,
      positionerElement,
      escapeKey: escapeKeyEnabled,
      outsidePressEnabled,
      bubbles: bubbleOptions,
    }) => {
      if (!open || !isEnabled) {
        // Reset here, not in the cleanup, which also runs when a dependency changes mid-gesture.
        if (!open) {
          sawPressWhileOpen = false;
          compositionEndPending = false;
          currentPointerType = '';
          touchState = null;
        }
        clearInsideReactTree();
        return undefined;
      }

      const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = bubbleOptions;
      storeContext.escapeKeyBubbles = escapeKeyBubbles;
      storeContext.outsidePressBubbles = outsidePressBubbles;

      const preventedPressSuppressionTimeout = new Timeout();
      const doc = ownerDocument(positionerElement);

      function handleCompositionEnd() {
        // Safari fires `compositionend` before `keydown`, so we need to wait until the next tick
        // before dismissing. https://bugs.webkit.org/show_bug.cgi?id=165004
        compositionEndPending = true;
        compositionTimeout.start(
          // 0ms or 1ms don't work in Safari. 5ms appears to consistently work.
          platform.engine.webkit ? 5 : 0,
          () => {
            compositionEndPending = false;
          },
        );
      }

      function suppressImmediateOutsideClickAfterPreventedStart() {
        suppressNextOutsideClick = true;
        // Firefox can emit the synthetic outside click in a later task after pointer lock exit,
        // so microtask clearing is too early here.
        preventedPressSuppressionTimeout.start(0, () => {
          suppressNextOutsideClick = false;
        });
      }

      function resetPressStartState() {
        pressStartedInside = false;
        pressStartPrevented = false;
        pressStartEvents = [];
      }

      function getOutsidePressEvent(): PressType {
        const type = currentPointerType as 'pen' | 'mouse' | 'touch' | '';
        const computedType = type === 'pen' || !type ? 'mouse' : type;

        const value = options.outsidePressEvent ?? 'sloppy';
        const resolved = typeof value === 'function' ? value() : value;

        if (typeof resolved === 'string') {
          return resolved;
        }

        return resolved[computedType];
      }

      function shouldIgnoreEvent(event: Event) {
        const computedOutsidePressEvent = getOutsidePressEvent();
        return (
          (computedOutsidePressEvent === 'intentional' && event.type !== 'click') ||
          (computedOutsidePressEvent === 'sloppy' && event.type === 'click')
        );
      }

      function isEventWithinFloatingTree(event: Event) {
        const nodeId = storeContext.positioning?.nodeId;
        const targetIsInsideChildren =
          tree &&
          getNodeChildren(tree.nodesRef.current, nodeId).some((node) =>
            isEventTargetWithin(event, node.context?.elements.floating),
          );

        return isEventWithinOwnElements(event) || targetIsInsideChildren;
      }

      function callOutsidePress(event: MouseEvent | TouchEvent) {
        const outsidePress = outsidePressOption();
        return typeof outsidePress === 'function' ? outsidePress(event) : true;
      }

      function closeOnPressOutside(event: MouseEvent | PointerEvent | TouchEvent) {
        if (shouldIgnoreEvent(event)) {
          // A new press began outside the floating element and its trigger. Clear any leftover
          // drag-out suppression so this press's eventual click can dismiss.
          if (event.type !== 'click' && !isEventWithinOwnElements(event)) {
            preventedPressSuppressionTimeout.clear();
            suppressNextOutsideClick = false;
          }
          clearInsideReactTree();
          return;
        }

        if (storeContext.insideReactTree) {
          clearInsideReactTree();
          return;
        }

        // A press in content rendered inside the floating element's component tree (such as a
        // nested popup's portal) counts as inside, like React's synthetic events.
        if (isEventInsideComponentTree(event, store.select('positionerElement'))) {
          return;
        }

        if ((pressLayers.get(event) ?? 0) > layer) {
          return;
        }

        const target = getTarget(event);
        const inertSelector = `[${createAttribute('inert')}]`;
        const targetRoot = isElement(target) ? target.getRootNode() : null;
        const markers = Array.from(
          (isShadowRoot(targetRoot)
            ? targetRoot
            : ownerDocument(store.select('positionerElement'))
          ).querySelectorAll(inertSelector),
        );

        const triggers = store.context.triggerElements;

        // If another trigger is clicked, don't close the floating element.
        if (
          target &&
          (triggers.hasElement(target as Element) ||
            triggers.hasMatchingElement((trigger) => contains(trigger, target as Element)))
        ) {
          return;
        }

        let targetRootAncestor = isElement(target) ? target : null;
        while (targetRootAncestor && !isLastTraversableNode(targetRootAncestor)) {
          const nextParent = getParentNode(targetRootAncestor);
          if (isLastTraversableNode(nextParent) || !isElement(nextParent)) {
            break;
          }

          targetRootAncestor = nextParent;
        }

        // Check if the click occurred on a third-party element injected after the floating
        // element rendered.
        if (
          markers.length &&
          isElement(target) &&
          !isRootElement(target) &&
          // Clicked on a direct ancestor (e.g. FloatingOverlay).
          !contains(target, store.select('positionerElement')) &&
          // If the target root element contains none of the markers, then the element was
          // injected after the floating element rendered.
          markers.every((marker) => !contains(targetRootAncestor, marker))
        ) {
          return;
        }

        // Check if the click occurred on the scrollbar.
        // Skip for touch events: scrollbars don't receive touch events on most platforms.
        if (isHTMLElement(target) && !('touches' in event)) {
          const lastTraversableNode = isLastTraversableNode(target);
          const style = getComputedStyle(target);
          const scrollRe = /auto|scroll/;
          const isScrollableX = lastTraversableNode || scrollRe.test(style.overflowX);
          const isScrollableY = lastTraversableNode || scrollRe.test(style.overflowY);

          const canScrollX =
            isScrollableX && target.clientWidth > 0 && target.scrollWidth > target.clientWidth;
          const canScrollY =
            isScrollableY && target.clientHeight > 0 && target.scrollHeight > target.clientHeight;

          const isRTL = style.direction === 'rtl';

          const pressedVerticalScrollbar =
            canScrollY &&
            (isRTL
              ? event.offsetX <= target.offsetWidth - target.clientWidth
              : event.offsetX > target.clientWidth);

          const pressedHorizontalScrollbar = canScrollX && event.offsetY > target.clientHeight;

          if (pressedVerticalScrollbar || pressedHorizontalScrollbar) {
            return;
          }
        }

        if (isEventWithinFloatingTree(event)) {
          return;
        }

        // Only `click` events reach this point in intentional mode.
        if (getOutsidePressEvent() === 'intentional') {
          // Press-less clicks (keyboard, assistive technology, `element.click()`) report no click
          // count; `isVirtualClick` also catches the ones that do.
          if (
            (event as MouseEvent).detail !== 0 &&
            !isVirtualClick(event as MouseEvent) &&
            !sawPressWhileOpen
          ) {
            return;
          }

          // A press that starts inside and ends outside gets one suppressed outside click.
          if (suppressNextOutsideClick) {
            preventedPressSuppressionTimeout.clear();
            suppressNextOutsideClick = false;
            return;
          }
        }

        if (!callOutsidePress(event)) {
          return;
        }

        if (hasBlockingChild('outsidePressBubbles')) {
          return;
        }

        store.setOpen(false, createChangeEventDetails(REASONS.outsidePress, event));
        clearInsideReactTree();
      }

      function handlePointerDown(event: PointerEvent) {
        if (
          getOutsidePressEvent() !== 'sloppy' ||
          event.pointerType === 'touch' ||
          !store.select('open') ||
          !enabled() ||
          isEventWithinOwnElements(event)
        ) {
          return;
        }

        closeOnPressOutside(event);
      }

      function handleTouchStart(event: TouchEvent) {
        if (
          getOutsidePressEvent() !== 'sloppy' ||
          !store.select('open') ||
          !enabled() ||
          isEventWithinOwnElements(event)
        ) {
          return;
        }

        const touch = event.touches[0];
        if (touch) {
          touchState = {
            startTime: Date.now(),
            startX: touch.clientX,
            startY: touch.clientY,
            dismissOnTouchEnd: false,
            dismissOnMouseDown: true,
          };

          cancelDismissOnEndTimeout.start(1000, () => {
            if (touchState) {
              touchState.dismissOnTouchEnd = false;
              touchState.dismissOnMouseDown = false;
            }
          });
        }
      }

      function addTargetEventListenerOnce<EventType extends Event>(
        event: EventType,
        listener: (event: EventType) => void,
      ) {
        const target = getTarget(event);

        if (!target) {
          return;
        }

        // If propagation stops before the target, this runs on the next event of the type to
        // reach it instead, which must not be handled as the stopped one.
        const unsubscribe = addEventListener(target, event.type, (currentEvent: Event) => {
          unsubscribe();
          if (currentEvent === event) {
            listener(event);
          }
        });
      }

      function handleTouchStartCapture(event: TouchEvent) {
        currentPointerType = 'touch';
        addTargetEventListenerOnce(event, handleTouchStart);
      }

      function closeOnPressOutsideCapture(event: PointerEvent | MouseEvent) {
        cancelDismissOnEndTimeout.clear();

        // Only `pointerdown` marks a press; `mousedown` is its compatibility event, and counting
        // it would misattribute a gesture that started before open.
        if (event.type === 'pointerdown') {
          // Only a primary press can produce a `click`.
          if (event.button === 0) {
            sawPressWhileOpen = true;
          }
          currentPointerType = (event as PointerEvent).pointerType;
        }

        if (event.type === 'mousedown' && touchState && !touchState.dismissOnMouseDown) {
          return;
        }

        addTargetEventListenerOnce(event, (targetEvent) => {
          if (targetEvent.type === 'pointerdown') {
            handlePointerDown(targetEvent as PointerEvent);
          } else {
            closeOnPressOutside(targetEvent as MouseEvent);
          }
        });
      }

      function handlePressEndCapture(event: PointerEvent | MouseEvent) {
        // A cancelled gesture produces no click. Not cleared on `pointerup`: the click fires
        // after it and must still find the press.
        if (event.type === 'pointercancel') {
          sawPressWhileOpen = false;
        }

        if (!pressStartedInside) {
          return;
        }

        const pressStartedInsideDefaultPrevented =
          pressStartPrevented || pressStartEvents.some((startEvent) => startEvent.defaultPrevented);
        resetPressStartState();

        if (getOutsidePressEvent() !== 'intentional') {
          return;
        }

        if (event.type === 'pointercancel') {
          if (pressStartedInsideDefaultPrevented) {
            suppressImmediateOutsideClickAfterPreventedStart();
          }
          return;
        }

        if (isEventWithinFloatingTree(event)) {
          return;
        }

        // If pointerdown was prevented, no click may be generated for that interaction. However,
        // Firefox may still emit an immediate click after pointerup, so suppress for one tick to
        // absorb that synthetic click only.
        if (pressStartedInsideDefaultPrevented) {
          suppressImmediateOutsideClickAfterPreventedStart();
          return;
        }

        // Avoid suppressing when outsidePress explicitly ignores this target.
        if (!callOutsidePress(event as MouseEvent)) {
          return;
        }

        preventedPressSuppressionTimeout.clear();
        suppressNextOutsideClick = true;
        clearInsideReactTree();
      }

      function handleTouchMove(event: TouchEvent) {
        if (getOutsidePressEvent() !== 'sloppy' || !touchState || isEventWithinOwnElements(event)) {
          return;
        }

        const touch = event.touches[0];
        if (!touch) {
          return;
        }

        const deltaX = Math.abs(touch.clientX - touchState.startX);
        const deltaY = Math.abs(touch.clientY - touchState.startY);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance > 5) {
          touchState.dismissOnTouchEnd = true;
        }

        if (distance > 10) {
          closeOnPressOutside(event);
          cancelDismissOnEndTimeout.clear();
          touchState = null;
        }
      }

      function handleTouchMoveCapture(event: TouchEvent) {
        addTargetEventListenerOnce(event, handleTouchMove);
      }

      function handleTouchEnd(event: TouchEvent) {
        if (getOutsidePressEvent() !== 'sloppy' || !touchState || isEventWithinOwnElements(event)) {
          return;
        }

        if (touchState.dismissOnTouchEnd) {
          closeOnPressOutside(event);
        }

        cancelDismissOnEndTimeout.clear();
        touchState = null;
      }

      function handleTouchEndCapture(event: TouchEvent) {
        addTargetEventListenerOnce(event, handleTouchEnd);
      }

      // Recorded in the capture phase, so every open floating element has claimed the press
      // before the target-phase `closeOnPressOutside` checks run.
      function recordPressLayer(event: Event) {
        if (isEventTargetWithin(event, store.select('positionerElement'))) {
          pressLayers.set(event, Math.max(pressLayers.get(event) ?? 0, layer));
        }
      }

      const unsubscribe = mergeCleanups(
        addEventListener(doc, 'pointerdown', recordPressLayer, true),
        addEventListener(doc, 'mousedown', recordPressLayer, true),
        addEventListener(doc, 'click', recordPressLayer, true),
        addEventListener(doc, 'touchmove', recordPressLayer, {
          capture: true,
          passive: true,
        }),
        addEventListener(doc, 'touchend', recordPressLayer, {
          capture: true,
          passive: true,
        }),
        escapeKeyEnabled &&
          mergeCleanups(
            addEventListener(
              doc,
              'keydown',
              (event) => {
                if (!escapeKeyBubbles) {
                  escapeLayers.set(event, Math.max(escapeLayers.get(event) ?? 0, layer));
                }
              },
              true,
            ),
            addEventListener(doc, 'keydown', (event) => {
              if (layer >= (escapeLayers.get(event) ?? 0)) {
                closeOnEscapeKeyDown(event);
              }
            }),
            addEventListener(doc, 'compositionend', handleCompositionEnd),
          ),
        outsidePressEnabled &&
          mergeCleanups(
            addEventListener(doc, 'click', closeOnPressOutsideCapture, true),
            addEventListener(doc, 'pointerdown', closeOnPressOutsideCapture, true),
            addEventListener(doc, 'pointerup', handlePressEndCapture, true),
            addEventListener(doc, 'pointercancel', handlePressEndCapture, true),
            addEventListener(doc, 'mousedown', closeOnPressOutsideCapture, true),
            addEventListener(doc, 'mouseup', handlePressEndCapture, true),
            addEventListener(doc, 'touchstart', handleTouchStartCapture, {
              capture: true,
              passive: true,
            }),
            addEventListener(doc, 'touchmove', handleTouchMoveCapture, {
              capture: true,
              passive: true,
            }),
            addEventListener(doc, 'touchend', handleTouchEndCapture, {
              capture: true,
              passive: true,
            }),
          ),
      );

      return () => {
        unsubscribe();
        preventedPressSuppressionTimeout.clear();
        resetPressStartState();
        suppressNextOutsideClick = false;
      };
    },
  );

  const reference = {
    onKeyDown(event: KeyboardEvent) {
      closeOnEscapeKeyDown(event);
    },
    onPointerDown(event: PointerEvent) {
      closeOnReferencePress(event);
    },
    onClick(event: MouseEvent) {
      closeOnReferencePress(event);
    },
  };

  const floating = {
    onKeyDown(event: KeyboardEvent) {
      closeOnEscapeKeyDown(event);
    },
  };

  return { reference, floating, trigger: reference };
}
