import { Show, createEffect, createMemo, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { getNodeName, isHTMLElement } from '@floating-ui/utils/dom';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { mergeCleanups } from '@egoist/solid-base-utils/mergeCleanups';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import { platform } from '@egoist/solid-base-utils/platform';
import { createAnimationFrame } from '@egoist/solid-base-utils/animationFrame';
import { ownerDocument, ownerWindow } from '@egoist/solid-base-utils/owner';
import { activeElement, closest, contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import type { RefCallback } from '@egoist/solid-base-utils/refs';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { FocusGuard } from './FocusGuard';
import {
  getFloatingFocusElement,
  isInsideComponentTree,
  isTypeableCombobox,
  isTypeableElement,
} from '../element';
import { isVirtualClick, isVirtualPointerEvent, stopEvent } from '../event';
import {
  tabbable,
  focusable,
  isOutsideEvent,
  isTabbable,
  getNextTabbable,
  getPreviousTabbable,
} from './tabbable';
import type { FocusableElement } from './tabbable';
import { getNodeAncestors, getNodeChildren } from '../tree/nodes';
import { isElementVisible } from '../../../internals/composite/listIndex';
import type { PopupInteractionStore } from '../types';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { createAttribute } from '../createAttribute';
import { enqueueFocus } from './enqueueFocus';
import { markOthers } from './markOthers';
import { usePortalContext } from '../portal/FloatingPortal';
import { useFloatingTree } from '../tree/FloatingTree';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import { CLICK_TRIGGER_IDENTIFIER } from '../../../internals/constants';
import type { FloatingUIOpenChangeDetails } from '../../../internals/types';
import type { InteractionType } from '../interactions/enhancedClickHandler';

/**
 * An element to focus: an element, a ref object holding one, or nothing.
 */
export type FocusTarget = HTMLElement | RefObject<HTMLElement | null> | null | undefined;

/**
 * Where to move focus when a popup opens or closes:
 * - `false`: Do not move focus.
 * - `true`: Move focus based on the default behavior.
 * - an element or a ref object (`{ current }`): Move focus to that element.
 * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
 *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the
 *   default behavior, or `false`/`undefined` to do nothing.
 */
export type FocusTargetProp =
  | boolean
  | HTMLElement
  | RefObject<HTMLElement | null>
  | ((interactionType: InteractionType) => boolean | HTMLElement | null | void)
  | undefined;

function resolveRef<T>(ref: T | RefObject<T> | null | undefined): T | null | undefined {
  if (ref != null && typeof ref === 'object' && 'current' in (ref as object)) {
    return (ref as RefObject<T>).current;
  }
  return ref as T | null | undefined;
}

function getEventType(event: Event, lastInteractionType?: InteractionType): InteractionType {
  const win = ownerWindow(getTarget(event) as Element | null);
  if (event instanceof win.KeyboardEvent) {
    return 'keyboard';
  }
  if (event instanceof win.FocusEvent) {
    // Focus events can be caused by a preceding pointer interaction (e.g., focusout on outside
    // press). Prefer the last known pointer type if provided, else treat as keyboard.
    return lastInteractionType || 'keyboard';
  }
  if ('pointerType' in event) {
    // A trusted click without a pointerType is keyboard/AT; only synthesized clicks (e.g. a test
    // harness) pair an empty pointerType with a click count.
    return (
      ((event as PointerEvent).pointerType as InteractionType) ||
      (isVirtualClick(event as PointerEvent) ? 'keyboard' : lastInteractionType || 'mouse')
    );
  }
  if ('touches' in event) {
    return 'touch';
  }
  if (event instanceof win.MouseEvent) {
    // onClick events may not contain pointer events, and will fall through to here
    return lastInteractionType || (event.detail === 0 ? 'keyboard' : 'mouse');
  }
  return '';
}

const LIST_LIMIT = 20;
let previouslyFocusedElements: WeakRef<Element>[] = [];

function clearDisconnectedPreviouslyFocusedElements() {
  previouslyFocusedElements = previouslyFocusedElements.filter((entry) => {
    return entry.deref()?.isConnected;
  });
}

function addPreviouslyFocusedElement(element: Element | null | undefined) {
  clearDisconnectedPreviouslyFocusedElements();
  if (element && getNodeName(element) !== 'body') {
    previouslyFocusedElements.push(new WeakRef(element));
    if (previouslyFocusedElements.length > LIST_LIMIT) {
      previouslyFocusedElements = previouslyFocusedElements.slice(-LIST_LIMIT);
    }
  }
}

function getPreviouslyFocusedElement(skipHidden?: boolean) {
  clearDisconnectedPreviouslyFocusedElements();
  for (let i = previouslyFocusedElements.length - 1; i >= 0; i -= 1) {
    const element = previouslyFocusedElements[i].deref();
    // The marker skips elements outside an open popup, such as behind a modal.
    if (!skipHidden || !closest(element, '[hidden],[data-base-ui-inert]')) {
      return element;
    }
  }
  return undefined;
}

function getFirstTabbableElement(container: Element | null) {
  if (!container) {
    return null;
  }

  if (isTabbable(container)) {
    return container;
  }

  return tabbable(container)[0] || container;
}

function handleTabIndex(floatingFocusElement: HTMLElement) {
  if (
    floatingFocusElement.hasAttribute('tabindex') &&
    !floatingFocusElement.hasAttribute('data-tabindex')
  ) {
    return;
  }

  if (!floatingFocusElement.getAttribute('role')?.includes('dialog')) {
    return;
  }

  const focusableElements = focusable(floatingFocusElement);
  const tabbableContent = focusableElements.filter((element) => {
    const dataTabIndex = element.getAttribute('data-tabindex') || '';
    return (
      isTabbable(element) ||
      (element.hasAttribute('data-tabindex') && !dataTabIndex.startsWith('-'))
    );
  });
  const tabIndex = floatingFocusElement.getAttribute('tabindex');

  if (tabbableContent.length === 0) {
    if (tabIndex !== '0') {
      floatingFocusElement.setAttribute('tabindex', '0');
      // Mark our own write so the externally-managed early-return above doesn't mistake it for a
      // user-authored `tabindex` and freeze management.
      floatingFocusElement.setAttribute('data-tabindex', '0');
    }
  } else if (
    tabIndex !== '-1' ||
    (floatingFocusElement.hasAttribute('data-tabindex') &&
      floatingFocusElement.getAttribute('data-tabindex') !== '-1')
  ) {
    floatingFocusElement.setAttribute('tabindex', '-1');
    floatingFocusElement.setAttribute('data-tabindex', '-1');
  }
}

export interface FloatingFocusManagerProps {
  children?: JSX.Element;
  /**
   * The popup's interaction store.
   */
  store: PopupInteractionStore;
  /**
   * The interaction type used to open the floating element. `null` means a programmatic open
   * (focus returns to the previously focused element first).
   * @default ''
   */
  openInteractionType?: InteractionType | null | undefined;
  /**
   * Whether the focus manager should be disabled. Useful to delay focus management until after a
   * transition completes or some other conditional state.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Determines the element to focus when the floating element is opened.
   * `true` focuses the first tabbable element, or the floating element itself.
   * @default true
   */
  initialFocus?: FocusTargetProp;
  /**
   * Determines the element to focus when the floating element is closed.
   * `true` focuses the reference, or the element focused before the popup opened.
   * @default true
   */
  returnFocus?: FocusTargetProp;
  /**
   * Whether `returnFocus` is an explicit consumer target. Internal dynamic defaults use `false`
   * so focus that has already moved outside the floating tree is respected.
   * @internal
   */
  explicitReturnFocus?: boolean | undefined;
  /**
   * Determines where focus should be restored if focus inside the floating element is lost
   * (such as due to the removal of the currently focused element from the DOM).
   * - `true`: the nearest tabbable element inside the floating tree
   * - `'popup'`: the floating element (container) itself
   * - `false`: do not restore focus
   * @default false
   */
  restoreFocus?: boolean | 'popup' | undefined;
  /**
   * Whether focus is “modal”: fully trapped inside the floating element, and outside content is
   * hidden from assistive technology.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Whether the floating element closes when focus moves outside of it (non-modal focus
   * management).
   * @default true
   */
  closeOnFocusOut?: boolean | undefined;
  /**
   * Overrides the element to focus when tabbing forward out of the floating element.
   */
  nextFocusableElement?: FocusTarget;
  /**
   * Overrides the element to focus when tabbing backward out of the floating element.
   */
  previousFocusableElement?: FocusTarget;
  /**
   * Ref to the focus guard preceding the floating element content.
   */
  beforeContentFocusGuardRef?: RefCallback<HTMLSpanElement> | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Additional elements that should be treated as part of the floating subtree even if they are
   * rendered outside the floating element itself.
   */
  getInsideElements?: (() => Array<Element | null | undefined>) | undefined;
}

/**
 * Provides focus management for the floating element: initial focus, focus trapping (modal) or
 * focus-out closing (non-modal), hiding outside content from assistive technology, and returning
 * focus on close. Renders focus guards around its children.
 * @internal
 */
export function FloatingFocusManager(props: FloatingFocusManagerProps): JSX.Element {
  const store = props.store;
  const disabled = () => props.disabled ?? false;
  const modal = () => props.modal ?? true;
  const closeOnFocusOut = () => props.closeOnFocusOut ?? true;
  const restoreFocus = () => props.restoreFocus ?? false;
  const initialFocus = () => props.initialFocus ?? true;
  const returnFocus = () => props.returnFocus ?? true;
  const openInteractionType = () =>
    props.openInteractionType === undefined ? '' : props.openInteractionType;

  const open = () => store.select('open');
  const domReference = () => store.select('anchorElement');
  const floating = () => store.select('positionerElement');
  const floatingFocusElement = createMemo(() => getFloatingFocusElement(floating()));

  const storeContext = store.context;
  const { events } = storeContext;

  const getNodeId = () => storeContext.positioning?.nodeId;

  // A typeable combobox reference (e.g. input/textarea) with `initialFocus={false}` has different
  // focus semantics: focus is not trapped inside the floating element, so in the modal case the
  // guards are not rendered, but `aria-hidden` is still applied to the outside nodes.
  const isUntrappedTypeableCombobox = () =>
    isTypeableCombobox(domReference()) && initialFocus() === false;

  const tree = useFloatingTree(untrack(() => props.externalTree));
  const portalContext = usePortalContext();

  let preventReturnFocus = false;
  let isPointerDown = false;
  let pointerDownOutside = false;
  let lastFocusedTabbable: FocusableElement | null = null;
  let closeType: InteractionType = '';
  let lastInteractionType: InteractionType = '';

  let beforeGuard: HTMLSpanElement | null = null;
  let afterGuard: HTMLSpanElement | null = null;

  const blurTimeout = createTimeout();
  const pointerDownTimeout = createTimeout();
  const restoreFocusFrame = createAnimationFrame();

  const isInsidePortal = portalContext != null;

  function getTabbableContent(container: Element | null = untrack(floatingFocusElement)) {
    return container ? tabbable(container) : [];
  }

  // Read at call time (like upstream's stable callback), also from effect callbacks.
  function getResolvedInsideElements() {
    return untrack(
      () =>
        props.getInsideElements?.().filter((element): element is Element => element != null) ??
        [],
    );
  }

  function getPreviousFocusableElement() {
    return resolveRef(untrack(() => props.previousFocusableElement));
  }

  function getNextFocusableElement() {
    return resolveRef(untrack(() => props.nextFocusableElement));
  }

  // Prevent Tab from escaping the modal when there are no tabbable elements.
  createEffect(
    () =>
      !disabled() && modal()
        ? { element: floatingFocusElement(), untrapped: isUntrappedTypeableCombobox() }
        : null,
    (value) => {
      if (!value) {
        return undefined;
      }
      const { element, untrapped } = value;

      function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Tab') {
          // The focus guards have nothing to focus, so we need to stop the event.
          if (
            contains(element, activeElement(ownerDocument(element))) &&
            getTabbableContent().length === 0 &&
            !untrapped
          ) {
            stopEvent(event);
          }
        }
      }

      return addEventListener(ownerDocument(element), 'keydown', onKeyDown);
    },
  );

  // Track pointer/keyboard interactions to disambiguate focus and outside presses.
  createEffect(
    () =>
      !disabled() && open()
        ? {
            floating: floating(),
            domReference: domReference(),
            focusElement: floatingFocusElement(),
          }
        : null,
    (value) => {
      if (!value) {
        return undefined;
      }

      const doc = ownerDocument(value.focusElement);

      function clearPointerDownOutside() {
        pointerDownOutside = false;
      }

      function onPointerDown(event: PointerEvent) {
        const target = getTarget(event) as Element | null;
        const insideElements = getResolvedInsideElements();
        const pointerTargetInside =
          contains(value!.floating, target) ||
          contains(value!.domReference, target) ||
          contains(portalContext?.portalNode(), target) ||
          insideElements.some((element) => element === target || contains(element, target));
        pointerDownOutside = !pointerTargetInside;
        lastInteractionType = (event.pointerType as InteractionType) || 'keyboard';

        if (closest(target, `[${CLICK_TRIGGER_IDENTIFIER}]`)) {
          isPointerDown = true;
          // Reset on the next tick so a single click on a click-trigger doesn't permanently
          // suppress focus-out closing.
          pointerDownTimeout.start(0, () => {
            isPointerDown = false;
          });
        }
      }

      function onKeyDown() {
        lastInteractionType = 'keyboard';
      }

      return mergeCleanups(
        addEventListener(doc, 'pointerdown', onPointerDown, true),
        addEventListener(doc, 'pointerup', clearPointerDownOutside, true),
        addEventListener(doc, 'pointercancel', clearPointerDownOutside, true),
        addEventListener(doc, 'keydown', onKeyDown, true),
        // Avoid a stale `true` leaking into the next open (e.g. keep-mounted popups) if the popup
        // dismissed between pointerdown and pointerup.
        clearPointerDownOutside,
      );
    },
  );

  // Close on focus out and restore focus within the floating tree when needed.
  createEffect(
    () =>
      !disabled() && closeOnFocusOut()
        ? {
            floating: floating(),
            domReference: domReference(),
            focusElement: floatingFocusElement(),
          }
        : null,
    (value) => {
      if (!value) {
        return undefined;
      }
      const { floating: floatingElement, domReference: reference, focusElement } = value;

      const doc = ownerDocument(focusElement);

      // In Safari, buttons lose focus when pressing them.
      function handlePointerDown() {
        isPointerDown = true;
        pointerDownTimeout.start(0, () => {
          isPointerDown = false;
        });
      }

      function handleFocusIn(event: FocusEvent) {
        const target = getTarget(event) as FocusableElement | null;
        if (isTabbable(target)) {
          lastFocusedTabbable = target;
        }
      }

      function handleFocusOutside(event: FocusEvent) {
        const relatedTarget = event.relatedTarget as HTMLElement | null;
        const currentTarget = event.currentTarget;
        const target = getTarget(event) as HTMLElement | null;

        // When focus is lost to the body (e.g. on a backdrop press), record the element that had
        // focus so a confirmation dialog opened while the body is focused can return focus to it.
        // Scoped to `modal` to avoid non-modal popups polluting the shared stack.
        if (modal() && relatedTarget == null && target != null && contains(floatingElement, target)) {
          addPreviouslyFocusedElement(target);
        }

        queueMicrotask(() => {
          const nodeId = getNodeId();
          const triggers = store.context.triggerElements;
          const insideElements = getResolvedInsideElements();
          const guards = portalContext?.guards;
          const isRelatedFocusGuard =
            relatedTarget?.hasAttribute(createAttribute('focus-guard')) &&
            [
              beforeGuard,
              afterGuard,
              guards?.beforeInside,
              guards?.afterInside,
              guards?.beforeOutside,
              guards?.afterOutside,
              getPreviousFocusableElement(),
              getNextFocusableElement(),
            ].includes(relatedTarget);

          const movedToUnrelatedNode = !(
            contains(reference, relatedTarget) ||
            contains(floatingElement, relatedTarget) ||
            contains(relatedTarget, floatingElement) ||
            contains(portalContext?.portalNode(), relatedTarget) ||
            isInsideComponentTree(floatingElement, relatedTarget) ||
            insideElements.some(
              (element) => element === relatedTarget || contains(element, relatedTarget),
            ) ||
            triggers.hasMatchingElement((trigger) => contains(trigger, relatedTarget)) ||
            isRelatedFocusGuard ||
            (tree &&
              (getNodeChildren(tree.nodesRef.current, nodeId).find(
                (node) =>
                  contains(node.context?.elements.floating, relatedTarget) ||
                  contains(node.context?.elements.domReference, relatedTarget),
              ) ||
                getNodeAncestors(tree.nodesRef.current, nodeId).find(
                  (node) =>
                    [
                      node.context?.elements.floating,
                      getFloatingFocusElement(node.context?.elements.floating),
                    ].includes(relatedTarget) ||
                    node.context?.elements.domReference === relatedTarget,
                )))
          );

          if (currentTarget === reference && focusElement) {
            handleTabIndex(focusElement);
          }

          const restore = restoreFocus();

          // Restore focus to the previously focused tabbable element to prevent focus from being
          // lost outside the floating tree.
          if (
            restore &&
            currentTarget !== reference &&
            !isElementVisible(target) &&
            activeElement(doc) === doc.body
          ) {
            // Let `FloatingPortal` know that focus is still inside the floating tree.
            if (isHTMLElement(focusElement)) {
              focusElement.focus();
              // If explicitly requested to restore focus to the popup container, do not search
              // for the next/previous tabbable element.
              if (restore === 'popup') {
                // If the focused element is removed on pointerdown, the browser tries to move focus
                // to it right after the `.focus()` call above, but because it's removed in the same
                // tick, focus is lost instead. Re-focusing asynchronously (next frame) wins that
                // race, but only while focus is still lost.
                restoreFocusFrame.request(() => {
                  const currentActiveElement = activeElement(doc);
                  if (currentActiveElement == null || currentActiveElement === doc.body) {
                    focusElement.focus();
                  }
                });
                return;
              }
            }

            const tabbableContent = getTabbableContent() as Array<Element | null>;
            const prevTabbable = lastFocusedTabbable;
            const nodeToFocus =
              (prevTabbable && tabbableContent.includes(prevTabbable) ? prevTabbable : null) ||
              tabbableContent[tabbableContent.length - 1] ||
              focusElement;

            if (isHTMLElement(nodeToFocus)) {
              nodeToFocus.focus();
            }
          }

          // https://github.com/floating-ui/floating-ui/issues/3060
          if (storeContext.insideReactTree) {
            storeContext.insideReactTree = false;
            return;
          }

          const untrapped = untrack(isUntrappedTypeableCombobox);

          // Focus did not move inside the floating tree, and there are no tabbable portal guards
          // to handle closing.
          if (
            (untrapped ? true : !modal()) &&
            relatedTarget &&
            movedToUnrelatedNode &&
            !isPointerDown &&
            // For an "untrapped" typeable combobox, re-opening the popup and tabbing out should
            // still close it even when the previously focused element is focused again.
            (untrapped || relatedTarget !== getPreviouslyFocusedElement())
          ) {
            preventReturnFocus = true;
            // A popup that stays mounted after it closed (during its exit animation or after
            // `preventUnmountOnClose()`) already reported that close.
            if (store.select('open')) {
              store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event));
            }
          }
        });
      }

      function markInsideReactTree() {
        if (pointerDownOutside) {
          return;
        }
        storeContext.insideReactTree = true;
        blurTimeout.start(0, () => {
          storeContext.insideReactTree = false;
        });
      }

      const anchorElement = isHTMLElement(reference) ? reference : null;
      if (!floatingElement && !anchorElement) {
        return undefined;
      }

      return mergeCleanups(
        anchorElement && addEventListener(anchorElement, 'focusout', handleFocusOutside),
        anchorElement && addEventListener(anchorElement, 'pointerdown', handlePointerDown),
        floatingElement && addEventListener(floatingElement, 'focusin', handleFocusIn),
        floatingElement && addEventListener(floatingElement, 'focusout', handleFocusOutside),
        floatingElement &&
          portalContext &&
          addEventListener(floatingElement, 'focusout', markInsideReactTree, true),
      );
    },
  );

  // Hide everything outside the floating tree from assistive tech while open.
  createEffect(
    () =>
      !disabled() && open() && floating()
        ? {
            floating: floating()!,
            modal: modal(),
            untrapped: isUntrappedTypeableCombobox(),
            domReference: domReference(),
            portalNode: portalContext?.portalNode() ?? null,
            previousFocusableElement: props.previousFocusableElement,
            nextFocusableElement: props.nextFocusableElement,
            getInsideElements: props.getInsideElements,
          }
        : null,
    (value) => {
      if (!value) {
        return undefined;
      }

      // Don't hide portals nested within the parent portal.
      const portalNodes = Array.from(
        value.portalNode?.querySelectorAll(`[${createAttribute('portal')}]`) || [],
      );

      const ancestors = tree ? getNodeAncestors(tree.nodesRef.current, getNodeId()) : [];
      const rootAncestorComboboxDomReference = untrack(
        () =>
          ancestors.find((node) =>
            isTypeableCombobox(node.context?.elements.domReference || null),
          )?.context?.elements.domReference,
      );

      const guards = portalContext?.guards;
      const controlInsideElements = [
        value.floating,
        ...portalNodes,
        beforeGuard,
        afterGuard,
        guards?.beforeOutside,
        guards?.afterOutside,
        ...getResolvedInsideElements(),
      ];
      const insideElements = [
        ...controlInsideElements,
        rootAncestorComboboxDomReference,
        resolveRef(value.previousFocusableElement),
        resolveRef(value.nextFocusableElement),
        value.untrapped ? value.domReference : null,
      ].filter((x): x is Element => x != null);

      const ariaHiddenCleanup = markOthers(insideElements, {
        ariaHidden: value.modal || value.untrapped,
        mark: false,
      });

      const markerInsideElements = [value.floating, ...portalNodes].filter(
        (x): x is Element => x != null,
      );
      const markerCleanup = markOthers(markerInsideElements);

      return () => {
        markerCleanup();
        ariaHiddenCleanup();
      };
    },
  );

  // Focus the initial element when the floating element opens.
  createEffect(
    () => (open() && !disabled() ? floatingFocusElement() : null),
    (focusElement) => {
      if (!isHTMLElement(focusElement)) {
        return;
      }

      closeType = '';
      lastInteractionType = '';

      const doc = ownerDocument(focusElement);
      const previouslyFocusedElement = activeElement(doc);

      // Wait for pending updates (such as `tabindex` writes) before resolving the target.
      queueMicrotask(() => {
        const initialFocusValueOrFn = untrack(initialFocus);
        const resolvedInitialFocus =
          typeof initialFocusValueOrFn === 'function'
            ? initialFocusValueOrFn(untrack(openInteractionType) || '')
            : initialFocusValueOrFn;

        // `null` should fall back to the default behavior in case of an empty ref.
        if (resolvedInitialFocus === undefined || resolvedInitialFocus === false) {
          return;
        }

        const focusAlreadyInsideFloatingEl = contains(focusElement, previouslyFocusedElement);

        if (focusAlreadyInsideFloatingEl) {
          return;
        }

        let focusableElements: Array<FocusableElement> | null = null;
        const getDefaultFocusElement = () => {
          if (focusableElements == null) {
            focusableElements = getTabbableContent(focusElement);
          }

          return focusableElements[0] || focusElement;
        };

        let elToFocus: FocusableElement | null | undefined;
        if (resolvedInitialFocus === true || resolvedInitialFocus === null) {
          elToFocus = getDefaultFocusElement();
        } else {
          elToFocus = resolveRef(resolvedInitialFocus as FocusTarget);
        }
        elToFocus = elToFocus || getDefaultFocusElement();

        const hadFocusInside = contains(focusElement, activeElement(doc));

        // Screen readers re-sync focus to their cursor right after a synthesized press. A focus
        // that lands a frame later reads as a stray move and gets pulled back to the reference.
        const openEvent = storeContext.openEvent;
        const openedByVirtualPress =
          openEvent?.type === 'mousedown' && isVirtualClick(openEvent as MouseEvent);

        void enqueueFocus(elToFocus, {
          sync: openedByVirtualPress,
          preventScroll: elToFocus === focusElement,
          shouldFocus() {
            // If the floating element has closed before this runs — e.g. tabbing out of a
            // kept-mounted popup — don't pull focus back onto the initial element.
            if (!store.select('open')) {
              return false;
            }

            if (hadFocusInside) {
              return true;
            }

            const currentActiveElement = activeElement(doc);
            const focusMovedInside =
              currentActiveElement !== elToFocus &&
              contains(focusElement, currentActiveElement);

            return !focusMovedInside;
          },
        });
      });
    },
  );

  // A return-focus queued by the effect cleanup. If the effect re-arms right away, a dependency
  // changed while the popup stayed open, so the cleanup was not a close.
  let pendingReturnFocus: { cancelled: boolean } | null = null;

  // Effects don't compare their compute results: memoize the dependencies so the return focus
  // target is only re-armed when one of them actually changes (upstream's dependency array).
  const returnFocusDeps = createMemo(
    () =>
      !disabled() && floatingFocusElement()
        ? {
            floating: floating(),
            focusElement: floatingFocusElement()!,
            domReference: domReference(),
          }
        : null,
    {
      equals: (a, b) =>
        a === b ||
        (a != null &&
          b != null &&
          a.floating === b.floating &&
          a.focusElement === b.focusElement &&
          a.domReference === b.domReference),
    },
  );

  // Track return focus targets and restore focus on unmount/close.
  createEffect(
    returnFocusDeps,
    (value) => {
      if (!value) {
        pendingReturnFocus = null;
        return undefined;
      }

      if (pendingReturnFocus) {
        pendingReturnFocus.cancelled = true;
        pendingReturnFocus = null;
      }

      const { floating: floatingElement, focusElement, domReference: reference } = value;
      const doc = ownerDocument(focusElement);
      const elementFocusedBeforeOpen = activeElement(doc);
      // Only an explicit `null` interaction type represents a programmatic open.
      const preferPreviousFocus = untrack(openInteractionType) == null;

      // Safari and Firefox on macOS don't focus a pressed button, so record the reference instead.
      addPreviouslyFocusedElement(
        elementFocusedBeforeOpen === doc.body && !preferPreviousFocus
          ? reference
          : elementFocusedBeforeOpen,
      );

      function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
        if (!details.open) {
          closeType = getEventType(details.nativeEvent, lastInteractionType);
        }

        // Focus guards transfer focus themselves; other close handlers may still need return
        // focus.
        if (
          (details.reason === REASONS.focusOut &&
            details.triggerElement?.hasAttribute(createAttribute('focus-guard'))) ||
          (details.reason === REASONS.triggerHover && details.nativeEvent.type === 'mouseleave')
        ) {
          preventReturnFocus = true;
        }

        if (details.reason !== REASONS.outsidePress) {
          return;
        }

        if (details.nested) {
          preventReturnFocus = false;
        } else if (
          isVirtualClick(details.nativeEvent as MouseEvent) ||
          isVirtualPointerEvent(details.nativeEvent as PointerEvent)
        ) {
          preventReturnFocus = false;
        } else {
          // On outside press, only return focus to the reference when the browser supports the
          // `focus({ preventScroll })` option; without it, restoring focus scrolls the page.
          let isPreventScrollSupported = false;
          ownerDocument(focusElement)
            .createElement('div')
            .focus({
              get preventScroll() {
                isPreventScrollSupported = true;
                return false;
              },
            });

          preventReturnFocus = !isPreventScrollSupported;
        }
      }

      events.on('openchange', onOpenChangeLocal);

      function getReturnElement(currentCloseType: InteractionType) {
        const returnFocusValueOrFn = untrack(returnFocus);
        let resolvedReturnFocusValue =
          typeof returnFocusValueOrFn === 'function'
            ? returnFocusValueOrFn(currentCloseType)
            : returnFocusValueOrFn;

        // `null` should fall back to the default behavior in case of an empty ref.
        if (resolvedReturnFocusValue === undefined || resolvedReturnFocusValue === false) {
          return null;
        }

        if (resolvedReturnFocusValue === null) {
          resolvedReturnFocusValue = true;
        }

        const referenceReturnElement = reference?.isConnected ? reference : null;
        const previousReturnElement =
          elementFocusedBeforeOpen?.isConnected && getNodeName(elementFocusedBeforeOpen) !== 'body'
            ? elementFocusedBeforeOpen
            : null;

        let defaultReturnElement = preferPreviousFocus
          ? previousReturnElement || referenceReturnElement
          : referenceReturnElement || previousReturnElement;

        if (!defaultReturnElement) {
          defaultReturnElement = getPreviouslyFocusedElement() || null;
        }

        if (typeof resolvedReturnFocusValue === 'boolean') {
          return defaultReturnElement;
        }

        return (
          resolveRef(resolvedReturnFocusValue as FocusTarget) || defaultReturnElement || null
        );
      }

      return () => {
        events.off('openchange', onOpenChangeLocal);

        const activeEl = activeElement(doc);
        const insideElements = getResolvedInsideElements();
        const isFocusInsideFloatingTree =
          contains(floatingElement, activeEl) ||
          insideElements.some((element) => element === activeEl || contains(element, activeEl)) ||
          (tree &&
            getNodeChildren(tree.nodesRef.current, getNodeId(), false).some((node) =>
              contains(node.context?.elements.floating, activeEl),
            ));

        const returnFocusValueOrFn = untrack(returnFocus);
        const currentCloseType = closeType;
        const returnElement = getReturnElement(currentCloseType);

        const job = { cancelled: false };
        pendingReturnFocus = job;

        queueMicrotask(() => {
          if (pendingReturnFocus === job) {
            pendingReturnFocus = null;
          }
          // `returnElement` if it is tabbable, otherwise its first tabbable child, otherwise
          // `returnElement` itself (which may not be tabbable at all).
          let tabbableReturnElement = getFirstTabbableElement(returnElement);
          // A hidden element, such as an item in a closed Select or `keepMounted` Menu, can't take
          // focus. Use the newest visible element focused before it instead, unless the closing
          // update already moved focus.
          if (tabbableReturnElement?.isConnected && closest(tabbableReturnElement, '[hidden]')) {
            tabbableReturnElement = [activeEl, doc.body].includes(activeElement(doc))
              ? getPreviouslyFocusedElement(true) || null
              : null;
          }
          // Read on purpose at this point: the latest `explicitReturnFocus` decides.
          const hasExplicitReturnFocus =
            untrack(() => props.explicitReturnFocus) ?? typeof returnFocusValueOrFn !== 'boolean';

          if (
            !job.cancelled &&
            returnFocusValueOrFn &&
            !preventReturnFocus &&
            isHTMLElement(tabbableReturnElement) &&
            // If the focus moved somewhere else after mount, avoid returning focus since it
            // likely entered a different element which should be respected:
            // https://github.com/floating-ui/floating-ui/issues/2607
            (!hasExplicitReturnFocus && tabbableReturnElement !== activeEl && activeEl !== doc.body
              ? isFocusInsideFloatingTree
              : true)
          ) {
            const focusOptions: FocusOptions & { focusVisible?: boolean } = {
              preventScroll: true,
            };
            if (currentCloseType === 'keyboard') {
              focusOptions.focusVisible = true;
            }
            tabbableReturnElement.focus(focusOptions);
          }

          // A cancelled return must also clear suppression before the next close.
          preventReturnFocus = false;
        });
      };
    },
  );

  // Safari may randomly scroll to the bottom of the page if an input inside a popup has focus
  // when the popup unmounts from the DOM. Blurring it before the popup unmounts prevents this.
  createEffect(
    () => (platform.engine.webkit && !open() ? floating() : null),
    (floatingElement) => {
      if (!floatingElement) {
        return;
      }

      const activeEl = activeElement(ownerDocument(floatingElement));
      if (!isHTMLElement(activeEl) || !isTypeableElement(activeEl)) {
        return;
      }

      if (contains(floatingElement, activeEl)) {
        activeEl.blur();
      }
    },
  );

  // Report the focus manager state (modal, closeOnFocusOut, open…) to the enclosing
  // `FloatingPortal`, which uses it to decide whether to render its own guards.
  if (portalContext) {
    createEffect(
      () =>
        disabled()
          ? null
          : {
              modal: modal(),
              closeOnFocusOut: closeOnFocusOut(),
              open: open(),
              onOpenChange: store.setOpen,
              domReference: domReference(),
            },
      (state) => {
        portalContext.setFocusManagerState(state);
        return () => {
          portalContext.setFocusManagerState(null);
        };
      },
    );
  }

  // Keep the floating element tabIndex in sync and clear stale focus records.
  createEffect(
    () => (disabled() ? null : floatingFocusElement()),
    (focusElement) => {
      if (!focusElement) {
        return undefined;
      }
      handleTabIndex(focusElement);
      return () => {
        queueMicrotask(clearDisconnectedPreviouslyFocusedElements);
      };
    },
  );

  onCleanup(() => {
    pendingReturnFocus = null;
  });

  function onBeforeGuardFocus(event: FocusEvent) {
    if (modal()) {
      const els = getTabbableContent();
      els[els.length - 1]?.focus();
    } else {
      const portalNode = portalContext?.portalNode();
      if (portalNode) {
        preventReturnFocus = false;
        if (isOutsideEvent(event, portalNode)) {
          getNextTabbable(domReference())?.focus();
        } else {
          (getPreviousFocusableElement() ?? portalContext!.guards.beforeOutside)?.focus();
        }
      }
    }
  }

  function onAfterGuardFocus(event: FocusEvent) {
    if (modal()) {
      getTabbableContent()[0]?.focus();
    } else {
      const portalNode = portalContext?.portalNode();
      if (portalNode) {
        if (closeOnFocusOut()) {
          preventReturnFocus = true;
        }

        if (isOutsideEvent(event, portalNode)) {
          getPreviousTabbable(domReference())?.focus();
        } else {
          (getNextFocusableElement() ?? portalContext!.guards.afterOutside)?.focus();
        }
      }
    }
  }

  const shouldRenderGuards = () =>
    !disabled() && (modal() ? !isUntrappedTypeableCombobox() : true) && (isInsidePortal || modal());

  return (
    <>
      <Show when={shouldRenderGuards()}>
        <FocusGuard
          data-type="inside"
          ref={(el: HTMLSpanElement) => {
            beforeGuard = el;
            props.beforeContentFocusGuardRef?.(el);
            if (portalContext) {
              portalContext.guards.beforeInside = el;
            }
            // React's `onFocus` listens to `focusin`, which runs after `FloatingPortal`'s capture
            // listener re-enabled the tabbable content of the portal. A native `focus` listener
            // would run before it.
            el.addEventListener('focusin', onBeforeGuardFocus);
          }}
        />
      </Show>
      {props.children}
      <Show when={shouldRenderGuards()}>
        <FocusGuard
          data-type="inside"
          ref={(el: HTMLSpanElement) => {
            afterGuard = el;
            if (portalContext) {
              portalContext.guards.afterInside = el;
            }
            el.addEventListener('focusin', onAfterGuardFocus);
          }}
        />
      </Show>
    </>
  );
}
