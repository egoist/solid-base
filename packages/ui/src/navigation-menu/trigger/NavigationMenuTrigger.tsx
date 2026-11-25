import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  flush,
  omit,
  onCleanup,
  untrack,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { ownerWindow } from '@egoist/solid-base-utils/owner';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import { createAnimationFrame } from '@egoist/solid-base-utils/animationFrame';
import { closest, contains } from '@egoist/solid-base-utils/shadowDom';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { createClick } from '../../utils/popups/interactions/click';
import { createFloatingRootStore } from '../../utils/popups/floating-root/createFloatingRootStore';
import { useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import { createHoverTriggerInteraction } from '../../utils/popups/interactions/hoverTriggerInteraction';
import { getHoverIntent } from '../../utils/popups/interactions/hoverIntent';
import {
  getTabbableNearElement,
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
} from '../../utils/popups/focus/tabbable';
import { stopEvent } from '../../utils/popups/event';
import type { HandleCloseContextBase } from '../../utils/popups/interactions/hoverShared';
import type { BaseUIComponentProps, NativeButtonProps, HTMLProps } from '../../internals/types';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { ownerVisuallyHidden, PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { FocusGuard } from '../../utils/popups/focus/FocusGuard';
import { pressableTriggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import * as TransitionStatusDataAttributes from '../../internals/TransitionStatusDataAttributes';
import { isOutsideMenuEvent } from '../utils/isOutsideMenuEvent';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { createButton } from '../../internals/use-button/createButton';
import { createAnimationsFinished } from '../../internals/animationsFinished';
import { getCssDimensions } from '../../utils/getCssDimensions';
import type { NavigationMenuRoot } from '../root/NavigationMenuRoot';
import { NAVIGATION_MENU_TRIGGER_IDENTIFIER } from '../utils/constants';
import { setSharedFixedSize } from '../utils/setSharedFixedSize';
import { useNavigationMenuDismissContext } from '../list/NavigationMenuDismissContext';
import * as NavigationMenuPopupCssVars from '../popup/NavigationMenuPopupCssVars';
import * as NavigationMenuPositionerCssVars from '../positioner/NavigationMenuPositionerCssVars';
import { mergeProps } from '../../merge-props/mergeProps';
import { useDirection } from '../../internals/direction-context/DirectionContext';

const DEFAULT_SIZE = { width: 0, height: 0 };

type PointerType = 'mouse' | 'touch' | 'pen' | '';

/**
 * Opens the navigation menu popup when hovered or clicked, revealing the
 * associated content.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuTrigger(componentProps: NavigationMenuTrigger.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'nativeButton', 'disabled');

  const disabled = () => componentProps.disabled ?? false;

  const context = useNavigationMenuRootContext();
  const item = useNavigationMenuItemContext();
  const nodeId = useNavigationMenuTreeContext();
  const tree = useFloatingTree();
  const dismissProps = useNavigationMenuDismissContext();
  const direction = useDirection();
  const nested = context.nested;

  const stickIfOpenTimeout = createTimeout();
  const mutationFrame = createAnimationFrame();
  const resizeFrame = createAnimationFrame();
  const sizeFrame = createAnimationFrame();

  const [triggerElement, setTriggerElement] = createSignal<HTMLElement | null>(null);
  // Read when a press is handled, so it doesn't need to be reactive.
  let stickIfOpen = true;
  // The latest pointer type, read synchronously by the handlers of the following events. The
  // signal mirrors it for the reactive consumers (the safe polygon options).
  let pointerType: PointerType = '';
  const [pointerTypeState, setPointerTypeState] = createSignal<PointerType>('');

  let triggerElementRef: HTMLElement | null = null;
  // Whether the item was active when the current press started. Upstream's click handler reads
  // the render-time `isActiveItem`, while here the activation flushes before it runs.
  let pressToggle: boolean | undefined;
  let prevSize = DEFAULT_SIZE;
  let skipAutoSizeSync = false;

  // Imperative reads (handlers, effect `apply` phases) of reactive values.
  const itemValue = () => untrack(() => item.value);
  const isDisabled = () => untrack(disabled);

  const isActiveItem = createMemo(() => context.open && context.value === item.value);
  const interactionsEnabled = () =>
    (context.positionerElement != null || context.value == null) && !disabled();
  const hoverPopupElement = () => context.positionerElement || context.viewportElement;
  const hoverInteractionsEnabled = () =>
    (hoverPopupElement() != null || context.value == null) && !disabled();

  const runOnceAnimationsFinish = createAnimationsFinished(() => context.popupElement);

  function setPointerType(next: PointerType) {
    pointerType = next;
    setPointerTypeState(next);
  }

  function handleTriggerElement(element: HTMLElement) {
    triggerElementRef = element;
    setTriggerElement(element);
  }

  onCleanup(() => {
    triggerElementRef = null;
  });

  function cancelAutoSizeReset(force = false) {
    const resetState = context.popupAutoSizeResetRef.current;
    if (!force && resetState.owner !== itemValue()) {
      return;
    }

    resetState.abortController?.abort();
    resetState.abortController = null;
    resetState.owner = null;
  }

  createEffect(isActiveItem, (active) => {
    if (active) {
      return;
    }

    mutationFrame.cancel();
    sizeFrame.cancel();
    cancelAutoSizeReset();
  });

  function setAutoSizes(element: HTMLElement) {
    element.style.setProperty(NavigationMenuPopupCssVars.popupWidth, 'auto');
    element.style.setProperty(NavigationMenuPopupCssVars.popupHeight, 'auto');
  }

  function clearFixedSizes(popup: HTMLElement, positioner: HTMLElement) {
    popup.style.removeProperty(NavigationMenuPopupCssVars.popupWidth);
    popup.style.removeProperty(NavigationMenuPopupCssVars.popupHeight);
    positioner.style.removeProperty(NavigationMenuPositionerCssVars.positionerWidth);
    positioner.style.removeProperty(NavigationMenuPositionerCssVars.positionerHeight);
  }

  function scheduleAutoSizeReset(popup: HTMLElement) {
    cancelAutoSizeReset(true);

    const abortController = new AbortController();
    const resetState = context.popupAutoSizeResetRef.current;
    resetState.abortController = abortController;
    resetState.owner = itemValue();

    runOnceAnimationsFinish(() => {
      resetState.abortController = null;
      resetState.owner = null;
      setAutoSizes(popup);
    }, abortController.signal);
  }

  function handleValueChange(
    popup: HTMLElement,
    positioner: HTMLElement,
    currentWidthParam: number,
    currentHeightParam: number,
  ) {
    let currentWidth = currentWidthParam;
    let currentHeight = currentHeightParam;

    cancelAutoSizeReset(true);

    clearFixedSizes(popup, positioner);

    const { width, height } = getCssDimensions(popup);
    const measuredWidth = width || prevSize.width;
    const measuredHeight = height || prevSize.height;

    if (currentHeight === 0 || currentWidth === 0) {
      currentWidth = measuredWidth;
      currentHeight = measuredHeight;
    }

    popup.style.setProperty(NavigationMenuPopupCssVars.popupWidth, `${currentWidth}px`);
    popup.style.setProperty(NavigationMenuPopupCssVars.popupHeight, `${currentHeight}px`);
    positioner.style.setProperty(
      NavigationMenuPositionerCssVars.positionerWidth,
      `${measuredWidth}px`,
    );
    positioner.style.setProperty(
      NavigationMenuPositionerCssVars.positionerHeight,
      `${measuredHeight}px`,
    );

    sizeFrame.request(() => {
      if (!untrack(isActiveItem)) {
        return;
      }

      popup.style.setProperty(NavigationMenuPopupCssVars.popupWidth, `${measuredWidth}px`);
      popup.style.setProperty(NavigationMenuPopupCssVars.popupHeight, `${measuredHeight}px`);

      scheduleAutoSizeReset(popup);
    });
  }

  function handleInterruptedMutationResize(
    popup: HTMLElement,
    positioner: HTMLElement,
    currentWidth: number,
    currentHeight: number,
  ) {
    sizeFrame.cancel();
    mutationFrame.cancel();
    cancelAutoSizeReset(true);

    if (currentWidth === 0 || currentHeight === 0) {
      return;
    }

    setSharedFixedSize(popup, positioner, currentWidth, currentHeight);

    mutationFrame.request(() => {
      mutationFrame.request(() => {
        clearFixedSizes(popup, positioner);

        const { width, height } = getCssDimensions(popup);
        const measuredWidth = width || currentWidth;
        const measuredHeight = height || currentHeight;

        setSharedFixedSize(popup, positioner, currentWidth, currentHeight);

        sizeFrame.request(() => {
          if (!untrack(isActiveItem)) {
            return;
          }

          setSharedFixedSize(popup, positioner, measuredWidth, measuredHeight);
          scheduleAutoSizeReset(popup);
        });
      });
    });
  }

  function syncCurrentSize(popup: HTMLElement, positioner: HTMLElement) {
    sizeFrame.cancel();
    cancelAutoSizeReset(true);

    clearFixedSizes(popup, positioner);

    const { width, height } = getCssDimensions(popup);

    if (width === 0 || height === 0) {
      return;
    }

    prevSize = { width, height };
    setAutoSizes(popup);
    positioner.style.setProperty(NavigationMenuPositionerCssVars.positionerWidth, `${width}px`);
    positioner.style.setProperty(NavigationMenuPositionerCssVars.positionerHeight, `${height}px`);
  }

  function getMutationBaseline(popup: HTMLElement) {
    const popupWidth = popup.style.getPropertyValue(NavigationMenuPopupCssVars.popupWidth);
    const popupHeight = popup.style.getPropertyValue(NavigationMenuPopupCssVars.popupHeight);
    const isResizing =
      popupWidth !== '' && popupWidth !== 'auto' && popupHeight !== '' && popupHeight !== 'auto';

    if (!isResizing) {
      return { size: prevSize, syncPositioner: false };
    }

    return {
      size: {
        width: popup.offsetWidth || prevSize.width,
        height: popup.offsetHeight || prevSize.height,
      },
      syncPositioner: true,
    };
  }

  createEffect(
    () => context.open,
    (open) => {
      if (!open) {
        stickIfOpenTimeout.clear();
        mutationFrame.cancel();
        resizeFrame.cancel();
        sizeFrame.cancel();
        cancelAutoSizeReset(true);
        skipAutoSizeSync = false;
        setPointerType('');
      }
    },
  );

  createEffect(
    () => context.mounted,
    (mounted) => {
      if (!mounted) {
        prevSize = DEFAULT_SIZE;
      }
    },
  );

  createEffect(
    () => context.popupElement,
    (popupElement) => {
      if (!popupElement || typeof ResizeObserver !== 'function') {
        return undefined;
      }

      const resizeObserver = new ResizeObserver(() => {
        prevSize = {
          width: popupElement.offsetWidth,
          height: popupElement.offsetHeight,
        };
      });

      resizeObserver.observe(popupElement);

      return () => {
        resizeObserver.disconnect();
      };
    },
  );

  createEffect(
    () => {
      const popup = context.popupElement;
      const positioner = context.positionerElement;
      if (!context.open || !isActiveItem() || !popup || !positioner) {
        return null;
      }
      return { popup, positioner };
    },
    (elements) => {
      if (!elements) {
        return undefined;
      }

      const { popup, positioner } = elements;
      const win = ownerWindow(positioner);
      function handleResize() {
        resizeFrame.cancel();
        resizeFrame.request(() => syncCurrentSize(popup, positioner));
      }

      const unsubscribe = addEventListener(win, 'resize', handleResize);

      return () => {
        resizeFrame.cancel();
        unsubscribe();
      };
    },
  );

  createEffect(
    () => {
      const observedElement = context.currentContent;
      const popupElement = context.popupElement;
      const positionerElement = context.positionerElement;
      const transitionStatus = context.transitionStatus;
      if (
        !observedElement ||
        !popupElement ||
        !positionerElement ||
        !isActiveItem() ||
        typeof MutationObserver !== 'function'
      ) {
        return null;
      }
      return { observedElement, popupElement, positionerElement, transitionStatus };
    },
    (params) => {
      if (!params) {
        return undefined;
      }

      const { observedElement, popupElement, positionerElement, transitionStatus } = params;

      const mutationObserver = new MutationObserver(() => {
        if (
          transitionStatus === 'starting' ||
          popupElement.hasAttribute(TransitionStatusDataAttributes.startingStyle)
        ) {
          syncCurrentSize(popupElement, positionerElement);
          return;
        }

        const { size, syncPositioner } = getMutationBaseline(popupElement);

        if (syncPositioner) {
          handleInterruptedMutationResize(popupElement, positionerElement, size.width, size.height);
          return;
        }

        handleValueChange(popupElement, positionerElement, size.width, size.height);
      });

      mutationObserver.observe(observedElement, {
        childList: true,
        subtree: true,
        characterData: true,
        // `keepMounted` submenu switches update dimensions by toggling hidden
        // content rather than inserting or removing content nodes.
        attributes: true,
        attributeFilter: ['hidden'],
      });

      return () => {
        mutationObserver.disconnect();
      };
    },
  );

  createEffect(
    () => ({
      open: context.open,
      popupElement: context.popupElement,
      positionerElement: context.positionerElement,
      transitionStatus: context.transitionStatus,
    }),
    ({ open, popupElement, positionerElement }) => {
      if (untrack(isActiveItem) && open && popupElement && positionerElement) {
        if (skipAutoSizeSync) {
          skipAutoSizeSync = false;
          return;
        }

        const { width, height } = getCssDimensions(popupElement);
        handleValueChange(popupElement, positionerElement, width, height);
      }
    },
  );

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails: Omit<NavigationMenuRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) {
    const isHover = eventDetails.reason === REASONS.triggerHover;

    if (!untrack(interactionsEnabled)) {
      return;
    }

    if (pointerType === 'touch' && isHover) {
      return;
    }

    if (!nextOpen && context.value !== itemValue()) {
      return;
    }

    function changeState() {
      if (isHover) {
        // Only allow "patient" clicks to close the popup if it's open.
        // If they clicked within 500ms of the popup opening, keep it open.
        stickIfOpen = true;
        stickIfOpenTimeout.clear();
        stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
          stickIfOpen = false;
        });
      }

      if (nextOpen) {
        context.setValue(itemValue(), eventDetails);
      } else {
        context.setValue(null, eventDetails);
        setPointerType('');
      }
    }

    changeState();

    if (isHover) {
      flush();
    }
  }

  const floatingRootStore = createFloatingRootStore({
    open: () => context.open,
    onOpenChange: handleOpenChange as any,
    anchor: triggerElement,
    positionerElement: hoverPopupElement,
  });

  const hoverIntent = getHoverIntent(floatingRootStore);
  const shouldBlockSafePolygonPointerEvents = () => pointerType !== 'touch';

  createEffect(
    () => context.open,
    (open) => {
      if (!open) {
        floatingRootStore.context.openEvent = undefined;
        hoverIntent.reset();
        hoverIntent.cancelPendingOpen();
      }

      return hoverIntent.restoreOutsidePointerEvents;
    },
  );

  function getHandleCloseContextInline() {
    const popupElement = hoverPopupElement();
    if (!nested || context.positionerElement || !triggerElementRef || !popupElement) {
      return null;
    }

    return getHandleCloseContext(triggerElementRef, popupElement, nodeId);
  }

  function getScope() {
    if (nested && context.positionerElement) {
      return null;
    }

    return closest(triggerElementRef, 'ul');
  }

  const blockingSafePolygon = safePolygon({ blockPointerEvents: true, getScope });
  const nonBlockingSafePolygon = safePolygon({ blockPointerEvents: false, getScope });

  const hoverProps = createHoverTriggerInteraction(floatingRootStore, {
    get enabled() {
      return hoverInteractionsEnabled();
    },
    move: false,
    get handleClose() {
      return pointerTypeState() !== 'touch' ? blockingSafePolygon : nonBlockingSafePolygon;
    },
    get restMs() {
      return context.mounted && context.positionerElement ? 0 : context.delay;
    },
    get delay() {
      return { close: context.closeDelay };
    },
    get triggerElement() {
      return triggerElement();
    },
    getHandleCloseContext: getHandleCloseContextInline,
  });

  const click = createClick(floatingRootStore, {
    get enabled() {
      return interactionsEnabled();
    },
    stickIfOpen: () => stickIfOpen,
    get toggle() {
      return pressToggle ?? isActiveItem();
    },
  });

  const referenceProps = mergeProps(click.reference, hoverProps);

  createEffect(
    () => (isActiveItem() ? { element: triggerElement() } : null),
    (active) => {
      if (active) {
        context.setFloatingRootStore(floatingRootStore);
        context.prevTriggerElementRef.current = active.element;
      }
    },
  );

  function handleActivation(event: MouseEvent | KeyboardEvent) {
    const currentTarget = event.currentTarget as HTMLElement;
    const prevTriggerRect = context.prevTriggerElementRef.current?.getBoundingClientRect();
    const triggerEl = triggerElementRef;
    const value = context.value;
    const orientation = context.orientation;

    if (context.mounted && prevTriggerRect && triggerEl) {
      const nextTriggerRect = triggerEl.getBoundingClientRect();
      const isMovingRight = nextTriggerRect.left > prevTriggerRect.left;
      const isMovingDown = nextTriggerRect.top > prevTriggerRect.top;

      if (orientation === 'horizontal' && nextTriggerRect.left !== prevTriggerRect.left) {
        context.setActivationDirection(isMovingRight ? 'right' : 'left');
      } else if (orientation === 'vertical' && nextTriggerRect.top !== prevTriggerRect.top) {
        context.setActivationDirection(isMovingDown ? 'down' : 'up');
      }
    }

    // Reset the `openEvent` to `undefined` when the active item changes so that a
    // `click` -> `hover` on new trigger -> `hover` back to old trigger doesn't unexpectedly
    // cause the popup to remain stuck open when leaving the old trigger.
    if (event.type !== 'click' && value != null) {
      floatingRootStore.context.openEvent = undefined;
    }

    if (pointerType === 'touch' && event.type !== 'click') {
      flush();
      return;
    }

    // Keyboard open events reach this activation path after `onKeyDown` has already set
    // the value with the `listNavigation` reason.
    if (value != null && event.type !== 'keydown') {
      context.setValue(
        itemValue(),
        createChangeEventDetails(
          event.type === 'mouseenter' ? REASONS.triggerHover : REASONS.triggerPress,
          event,
        ),
      );
    }

    const popupElement = hoverPopupElement();

    if (
      event.type === 'mouseenter' &&
      shouldBlockSafePolygonPointerEvents() &&
      (!nested || !context.positionerElement) &&
      popupElement
    ) {
      const applyPointerEventsMutation = () => {
        const scopeElement = getScope() ?? currentTarget.ownerDocument.body;

        hoverIntent.blockOutsidePointerEvents({
          scopeElement,
          triggerElement: currentTarget,
          positionerElement: popupElement,
        });
      };

      if (value != null && value !== itemValue()) {
        queueMicrotask(applyPointerEventsMutation);
      } else {
        applyPointerEventsMutation();
      }
    }

    flush();
  }

  function handleOpenEvent(event: MouseEvent | KeyboardEvent) {
    if (isDisabled()) {
      return;
    }

    const popupElement = context.popupElement;
    const positionerElement = context.positionerElement;

    if (!popupElement || !positionerElement) {
      handleActivation(event);
      return;
    }

    const { width, height } = getCssDimensions(popupElement);
    const value = context.value;
    const shouldSkipAutoSizeSync =
      value != null && value !== itemValue() && (event.type === 'click' || pointerType !== 'touch');

    handleActivation(event);

    if (shouldSkipAutoSizeSync) {
      skipAutoSizeSync = true;
    }

    handleValueChange(popupElement, positionerElement, width, height);
  }

  const state: NavigationMenuTriggerState = {
    get open() {
      return isActiveItem();
    },
    get disabled() {
      return disabled();
    },
  };

  function handleSetPointerType(event: PointerEvent) {
    setPointerType(event.pointerType as PointerType);
  }

  function handleTriggerPointerDown(event: PointerEvent) {
    handleSetPointerType(event);
    hoverIntent.restoreOutsidePointerEvents();
  }

  const defaultProps: HTMLProps = {
    tabindex: 0,
    onMouseEnter: handleOpenEvent,
    onClick(event: MouseEvent) {
      pressToggle = untrack(isActiveItem);
      queueMicrotask(() => {
        pressToggle = undefined;
      });
      handleOpenEvent(event);
    },
    onPointerEnter: handleSetPointerType,
    onPointerDown: handleTriggerPointerDown,
    get 'aria-expanded'() {
      return isActiveItem();
    },
    get 'aria-controls'() {
      return isActiveItem() ? context.popupElement?.id : undefined;
    },
    [NAVIGATION_MENU_TRIGGER_IDENTIFIER as string]: '',
    onFocus() {
      if (!untrack(isActiveItem)) {
        return;
      }
      context.setViewportInert(false);
    },
    onMouseLeave() {
      if (context.value == null) {
        hoverIntent.restoreOutsidePointerEvents();
      }
    },
    onKeyDown(event: KeyboardEvent) {
      // For nested (submenu) triggers, don't intercept arrow keys that are used for
      // navigation in the parent content. The arrow keys should be handled by the
      // parent's CompositeRoot for navigating between items.
      if (nested) {
        return;
      }

      const orientation = context.orientation;
      const verticalOpenKey = untrack(direction) === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const openHorizontal = orientation === 'horizontal' && event.key === 'ArrowDown';
      const openVertical = orientation === 'vertical' && event.key === verticalOpenKey;

      if (openHorizontal || openVertical) {
        context.setValue(itemValue(), createChangeEventDetails(REASONS.listNavigation, event));
        handleOpenEvent(event);
        stopEvent(event);
      }
    },
    onBlur(event: FocusEvent) {
      const positionerElement = context.positionerElement;
      const popupElement = context.popupElement;
      if (
        positionerElement &&
        popupElement &&
        isOutsideMenuEvent(
          {
            currentTarget: event.currentTarget as HTMLElement | null,
            relatedTarget: event.relatedTarget as HTMLElement | null,
          },
          { popupElement, rootRef: context.rootRef, tree, nodeId },
        )
      ) {
        context.setValue(null, createChangeEventDetails(REASONS.focusOut, event));
      }
    },
  };

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: () => true,
    native: () => componentProps.nativeButton,
  });

  return (
    <>
      <CompositeItem
        tag="button"
        render={componentProps.render}
        class={componentProps.class}
        style={componentProps.style}
        state={state}
        stateAttributesMapping={pressableTriggerOpenStateMapping}
        ref={[handleTriggerElement, buttonRef]}
        props={[referenceProps, dismissProps, defaultProps, elementProps, getButtonProps]}
      />
      <Show when={isActiveItem()}>
        <TriggerFocusGuards
          triggerElement={triggerElement()}
          referenceElement={hoverPopupElement()}
          onFocusOut={(event) => {
            context.setValue(null, createChangeEventDetails(REASONS.focusOut, event));
          }}
        />
      </Show>
    </>
  );
}

function TriggerFocusGuards(props: {
  triggerElement: HTMLElement | null;
  referenceElement: HTMLElement | null;
  onFocusOut: (event: FocusEvent) => void;
}) {
  const context = useNavigationMenuRootContext();
  const nested = context.nested;

  let beforeOutside: HTMLSpanElement | null = null;
  let afterOutside: HTMLSpanElement | null = null;

  onCleanup(() => {
    if (context.beforeOutsideRef.current === beforeOutside) {
      context.beforeOutsideRef.current = null;
    }
    if (context.afterOutsideRef.current === afterOutside) {
      context.afterOutsideRef.current = null;
    }
  });

  return (
    <>
      <FocusGuard
        ref={(element: HTMLSpanElement) => {
          beforeOutside = element;
          context.beforeOutsideRef.current = element;
        }}
        // `focusin` (React's `onFocus`) runs after the Positioner's capture listener re-enables
        // the tabbable elements inside it, unlike the native `focus` event.
        onFocusIn={(event) => {
          const referenceElement = props.referenceElement;
          if (referenceElement && isOutsideEvent(event, referenceElement)) {
            context.beforeInsideRef.current?.focus();
          } else {
            const prevTabbable = getPreviousTabbable(props.triggerElement);
            prevTabbable?.focus();
          }
        }}
      />
      <span aria-owns={context.viewportElement?.id} style={ownerVisuallyHidden} />
      <FocusGuard
        ref={(element: HTMLSpanElement) => {
          afterOutside = element;
          context.afterOutsideRef.current = element;
        }}
        onFocusIn={(event) => {
          const referenceElement = props.referenceElement;
          const triggerElement = props.triggerElement;
          if (referenceElement && isOutsideEvent(event, referenceElement)) {
            context.setViewportInert(false);
            flush();
            const elementToFocus = context.afterInsideRef.current || triggerElement;
            elementToFocus?.focus();
          } else {
            let nextTabbable = getNextTabbable(triggerElement);

            if (
              nested &&
              !context.positionerElement &&
              referenceElement &&
              nextTabbable &&
              contains(referenceElement, nextTabbable)
            ) {
              nextTabbable = getTabbableNearElement(context.afterInsideRef.current, 1);
            }

            nextTabbable?.focus();

            if (
              (!nested || context.positionerElement) &&
              !contains(context.rootRef.current, nextTabbable)
            ) {
              props.onFocusOut(event);
            }
          }
        }}
      />
    </>
  );
}

export interface NavigationMenuTriggerState {
  /**
   * If `true`, the popup is open and the item is active.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface NavigationMenuTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', NavigationMenuTriggerState> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace NavigationMenuTrigger {
  export type State = NavigationMenuTriggerState;
  export type Props = NavigationMenuTriggerProps;
}

function getPlacementFromElements(
  anchorElement: Element,
  positionerElement: HTMLElement,
): HandleCloseContextBase['placement'] {
  const referenceRect = anchorElement.getBoundingClientRect();
  const floatingRect = positionerElement.getBoundingClientRect();
  const referenceCenterX = referenceRect.left + referenceRect.width / 2;
  const referenceCenterY = referenceRect.top + referenceRect.height / 2;
  const floatingCenterX = floatingRect.left + floatingRect.width / 2;
  const floatingCenterY = floatingRect.top + floatingRect.height / 2;
  const deltaX = floatingCenterX - referenceCenterX;
  const deltaY = floatingCenterY - referenceCenterY;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? 'right' : 'left';
  }

  return deltaY >= 0 ? 'bottom' : 'top';
}

function getHandleCloseContext(
  anchorElement: Element,
  positionerElement: HTMLElement,
  nodeId: string | undefined,
): HandleCloseContextBase {
  return {
    placement: getPlacementFromElements(anchorElement, positionerElement),
    elements: {
      domReference: anchorElement,
      floating: positionerElement,
    },
    nodeId,
  };
}
