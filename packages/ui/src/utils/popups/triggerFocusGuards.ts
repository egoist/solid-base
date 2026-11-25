import { flush, type Accessor } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { getTabbableNearElement, isOutsideEvent } from './focus/tabbable';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

/**
 * Minimal store interface required by the focus guard primitive.
 * Both PopoverStore and MenuStore satisfy this interface.
 */
export interface TriggerFocusGuardStore {
  setOpen(open: boolean, eventDetails: BaseUIChangeEventDetails<typeof REASONS.focusOut>): void;
  select(key: 'positionerElement'): HTMLElement | null;
  context: {
    /**
     * Shared with the focus manager through `getInsideElements` so that blurring the trigger
     * onto this guard does not close the popup before the guard's own focus handler runs.
     */
    readonly beforeTriggerFocusGuardRef: RefObject<HTMLElement | null>;
    readonly beforeContentFocusGuardRef: RefObject<HTMLElement | null>;
    readonly triggerFocusTargetRef: RefObject<HTMLElement | null>;
  };
}

export interface CreateTriggerFocusGuardsReturnValue {
  /**
   * `onFocus` handler of the focus guard rendered before the trigger: closes the popup and moves
   * focus to the tabbable element before the trigger.
   */
  handlePreFocusGuardFocus: (event: FocusEvent) => void;
  /**
   * `onFocus` handler of the focus target rendered after the trigger: when focus comes from
   * outside the popup, moves it into the popup (through its leading focus guard); otherwise
   * closes the popup and moves focus to the tabbable element after the trigger.
   */
  handleFocusTargetFocus: (event: FocusEvent) => void;
}

/**
 * Provides focus guard handlers for popup triggers (Popover, Menu).
 *
 * When the popup is open, invisible focus guard elements are placed before and after
 * the trigger. These handlers close the popup and move focus to the appropriate
 * tabbable element when the guards receive focus (i.e. when the user tabs out).
 *
 * @param store The popup store.
 * @param triggerElement Returns the trigger element (read when a guard receives focus).
 */
export function createTriggerFocusGuards(
  store: TriggerFocusGuardStore,
  triggerElement: Accessor<HTMLElement | null | undefined>,
): CreateTriggerFocusGuardsReturnValue {
  function closeAndFocus(
    event: FocusEvent,
    direction: 1 | -1,
    positionerElement: HTMLElement | null,
  ) {
    const guard = event.currentTarget as HTMLElement;

    store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event, guard));
    flush();

    // The close callback may change the tab order. Resolve it after the flush, using
    // the trigger as the anchor if the guard unmounted, even when its tabIndex is -1.
    getTabbableNearElement(
      guard.isConnected ? guard : (triggerElement() ?? null),
      direction,
      positionerElement,
    )?.focus();
  }

  function handlePreFocusGuardFocus(event: FocusEvent) {
    closeAndFocus(event, -1, store.select('positionerElement'));
  }

  function handleFocusTargetFocus(event: FocusEvent) {
    const positionerElement = store.select('positionerElement');
    if (positionerElement && isOutsideEvent(event, positionerElement)) {
      store.context.beforeContentFocusGuardRef.current?.focus();
    } else {
      closeAndFocus(event, 1, positionerElement);
    }
  }

  return { handlePreFocusGuardFocus, handleFocusTargetFocus };
}
