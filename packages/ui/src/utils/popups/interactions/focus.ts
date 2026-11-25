import { createEffect } from 'solid-js';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { platform } from '@egoist/solid-base-utils/platform';
import { mergeCleanups } from '@egoist/solid-base-utils/mergeCleanups';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import { activeElement, contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { getWindow, isElement, isHTMLElement } from '@floating-ui/utils/dom';
import type { ElementProps, PopupInteractionStore } from '../types';
import { createAttribute } from '../createAttribute';
import { isTargetInsideEnabledTrigger, isTypeableElement, matchesFocusVisible } from '../element';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import type { FloatingUIOpenChangeDetails, HTMLProps } from '../../../internals/types';

const isMacSafari = platform.os.mac && platform.engine.webkit;

export interface CreateFocusOptions {
  /**
   * Whether the interaction is enabled, including all internal effects and event handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Waits for the specified time before opening.
   * @default undefined
   */
  delay?: number | undefined;
}

/**
 * Opens the floating element while the reference element has focus, like CSS
 * `:focus`.
 *
 * Options are read lazily, so pass getters for reactive values. Returns props for the
 * `reference` (active trigger) and `trigger` (inactive triggers) elements; they are created once
 * and their handlers do nothing while disabled.
 * @see https://floating-ui.com/docs/useFocus
 */
export function createFocus(
  store: PopupInteractionStore,
  options: CreateFocusOptions = {},
): ElementProps {
  const enabled = () => options.enabled ?? true;

  const storeContext = store.context;
  const { events } = storeContext;

  let blockFocus = false;
  // Track which reference should be blocked from re-opening after Escape/press dismissal.
  let blockedReference: Element | null = null;
  let keyboardModality = true;

  const timeout = createTimeout();

  createEffect(
    () => (enabled() ? { domReference: store.select('anchorElement') } : null),
    (params) => {
      if (!params) {
        return undefined;
      }

      const win = getWindow(params.domReference);

      // If the reference was focused and the user left the tab/window, and the
      // floating element was not open, the focus should be blocked when they
      // return to the tab/window.
      function onBlur() {
        const currentDomReference = store.select('anchorElement');
        if (
          !store.select('open') &&
          isHTMLElement(currentDomReference) &&
          currentDomReference === activeElement(ownerDocument(currentDomReference))
        ) {
          blockFocus = true;
          blockedReference = currentDomReference;
        }
      }

      function onKeyDown() {
        keyboardModality = true;
      }

      function onPointerDown() {
        keyboardModality = false;
      }

      return mergeCleanups(
        addEventListener(win, 'blur', onBlur),
        isMacSafari && addEventListener(win, 'keydown', onKeyDown, true),
        isMacSafari && addEventListener(win, 'pointerdown', onPointerDown, true),
      );
    },
  );

  createEffect(enabled, (isEnabled) => {
    if (!isEnabled) {
      return undefined;
    }

    function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
      if (details.reason === REASONS.triggerPress || details.reason === REASONS.escapeKey) {
        const referenceElement = store.select('anchorElement');
        if (isElement(referenceElement)) {
          blockedReference = referenceElement;
          blockFocus = true;
        }
      }
    }

    events.on('openchange', onOpenChangeLocal);
    return () => {
      events.off('openchange', onOpenChangeLocal);
    };
  });

  function resetBlockedFocus() {
    blockFocus = false;
    blockedReference = null;
  }

  const reference: HTMLProps = {
    onMouseLeave() {
      if (!enabled()) {
        return;
      }
      resetBlockedFocus();
    },
    onFocus(event: FocusEvent) {
      if (!enabled()) {
        return;
      }

      const focusTarget = event.currentTarget as Element;

      if (blockFocus) {
        if (blockedReference === focusTarget) {
          return;
        }

        resetBlockedFocus();
      }

      const target = getTarget(event);

      if (isElement(target)) {
        // Safari fails to match `:focus-visible` if focus was initially
        // outside the document.
        if (isMacSafari && !event.relatedTarget) {
          if (!keyboardModality && !isTypeableElement(target)) {
            return;
          }
        } else if (!matchesFocusVisible(target)) {
          return;
        }
      }

      const movedFromOtherEnabledTrigger = isTargetInsideEnabledTrigger(
        event.relatedTarget,
        store.context.triggerElements,
      );

      const currentTarget = event.currentTarget as HTMLElement;
      const delay = options.delay;

      if ((store.select('open') && movedFromOtherEnabledTrigger) || !delay) {
        store.setOpen(true, createChangeEventDetails(REASONS.triggerFocus, event, currentTarget));
        return;
      }

      timeout.start(delay, () => {
        if (blockFocus) {
          return;
        }

        store.setOpen(true, createChangeEventDetails(REASONS.triggerFocus, event, currentTarget));
      });
    },
    onBlur(event: FocusEvent) {
      if (!enabled()) {
        return;
      }

      resetBlockedFocus();

      const relatedTarget = event.relatedTarget;

      // Hit the non-modal focus management portal guard. Focus will be
      // moved into the floating element immediately after.
      const movedToFocusGuard =
        isElement(relatedTarget) &&
        relatedTarget.hasAttribute(createAttribute('focus-guard')) &&
        relatedTarget.getAttribute('data-type') === 'outside';

      // Wait for the window blur listener to fire.
      timeout.start(0, () => {
        const domReference = store.select('anchorElement');
        const activeEl = activeElement(ownerDocument(domReference));

        // Focus left the page, keep it open.
        if (!relatedTarget && activeEl === domReference) {
          return;
        }

        // When focusing the reference element (e.g. regular click), then
        // clicking into the floating element, prevent it from hiding.
        // Note: it must be focusable, e.g. `tabindex="-1"`.
        // We can not rely on relatedTarget to point to the correct element
        // as it will only point to the shadow host of the newly focused element
        // and not the element that actually has received focus if it is located
        // inside a shadow root.
        if (
          contains(storeContext.positioning?.elements.floating, activeEl) ||
          contains(domReference, activeEl) ||
          movedToFocusGuard
        ) {
          return;
        }

        // If the next focused element is one of the triggers, do not close
        // the floating element. The focus handler of that trigger will
        // handle the open state.
        const nextFocusedElement = relatedTarget ?? activeEl;
        if (isTargetInsideEnabledTrigger(nextFocusedElement, store.context.triggerElements)) {
          return;
        }

        store.setOpen(false, createChangeEventDetails(REASONS.triggerFocus, event));
      });
    },
  } as HTMLProps;

  return { reference, trigger: reference };
}
