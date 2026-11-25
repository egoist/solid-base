import { createEffect, createMemo, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { TooltipRootContext } from './TooltipRootContext';
import { createClientPoint } from '../../utils/popups/interactions/clientPoint';
import { createDismiss } from '../../utils/popups/interactions/dismiss';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import {
  attachPopupHandle,
  createPopupRoot,
  renderPopupRootChildren,
} from '../../utils/popups/popupRoot';
import type { ActionsRef, PayloadChildRenderFunction } from '../../utils/popups/popupRoot';
import {
  createPopupInteractionProps,
  deriveActiveTriggerState,
} from '../../utils/popups/popupStoreUtils';
import { mergeProps } from '../../merge-props/mergeProps';
import { TooltipStore } from '../store/TooltipStore';
import type { TooltipHandle } from '../store/TooltipHandle';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';

/**
 * Groups all parts of the tooltip.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipRoot<Payload = unknown>(props: TooltipRoot.Props<Payload>): JSX.Element {
  const disabled = () => props.disabled ?? false;
  const trackCursorAxis = () => props.trackCursorAxis ?? 'none';

  const { store, transitionStatus } = createPopupRoot(
    props,
    (initialState, defaultPopupId) => new TooltipStore<Payload>(initialState, defaultPopupId),
    { closeOnActiveTriggerUnmount: true, disabled },
  );

  store.bind('trackCursorAxis', trackCursorAxis);
  store.bind('disableHoverablePopup', () => props.disableHoverablePopup ?? false);
  store.bind('disabled', disabled);

  // Disabling an open tooltip requests a close (it already renders as closed). The request answers
  // the change of `disabled`, so the effect doesn't track the open state it writes.
  createEffect(
    disabled,
    (isDisabled) => {
      if (isDisabled && store.select('open')) {
        store.setOpen(false, createChangeEventDetails(REASONS.disabled));
      }
    },
    { name: 'TooltipRoot.closeWhenDisabled' },
  );

  // Animations should be instant in two cases:
  // 1) Opening during the provider's instant phase (adjacent tooltip opens instantly)
  // 2) Closing because another tooltip opened (reason === 'none')
  // Otherwise, allow the animation to play. In particular, do not disable animations
  // during the 'ending' phase unless it's due to a sibling opening.
  const shouldBeInstant = createMemo(
    () => {
      const status = transitionStatus();
      return (
        (status === 'ending' && store.select('lastOpenChangeReason') === REASONS.none) ||
        (status !== 'ending' && store.select('isInstantPhase'))
      );
    },
    { name: 'TooltipRoot.shouldBeInstant' },
  );

  // While instant, `instantType` reads 'delay' to disable animations while moving from one trigger
  // to another within a delay group; the stored value shows through again afterwards.
  onCleanup(
    store.derive('instantType', (stored) => (shouldBeInstant() ? 'delay' : stored)),
  );

  // The payload and the trigger options come from the active trigger. A tooltip open (or closing)
  // without an active trigger has no payload.
  deriveActiveTriggerState(store, ['payload', 'closeOnClick', 'closeDelay'], {
    clearWithoutTrigger: ['payload'],
  });

  // Attached before the children render; a new `handle` prop re-attaches the same store.
  attachPopupHandle(() => props.handle, store);

  const dismiss = createDismiss(store, {
    get enabled() {
      return !disabled();
    },
    referencePress: () => store.select('closeOnClick'),
  });
  const clientPoint = createClientPoint(store, {
    get enabled() {
      return !disabled() && trackCursorAxis() !== 'none';
    },
    get axis() {
      const axis = trackCursorAxis();
      return axis === 'none' ? undefined : axis;
    },
  });

  // Both interactions return `trigger: reference`, so the active and inactive trigger props can
  // never differ. `createClientPoint` has no floating-side props.
  const triggerProps = mergeProps<HTMLProps>(clientPoint.reference, dismiss.reference);
  createPopupInteractionProps(store, {
    activeTriggerProps: triggerProps,
    inactiveTriggerProps: triggerProps,
    popupProps: dismiss.floating ?? {},
  });

  return (
    <TooltipRootContext value={store as TooltipStore<unknown>}>
      {renderPopupRootChildren<Payload>(
        props.children,
        () => store.select('payload') as Payload | undefined,
      )}
    </TooltipRootContext>
  );
}

export interface TooltipRootState {}

export interface TooltipRootProps<Payload = unknown> {
  /**
   * Whether the tooltip is initially open.
   *
   * To render a controlled tooltip, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the tooltip is currently open.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the tooltip is opened or closed.
   */
  onOpenChange?:
    | ((open: boolean, eventDetails: TooltipRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * Event handler called after any animations complete when the tooltip is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the tooltip contents can be hovered without closing the tooltip.
   * @default false
   */
  disableHoverablePopup?: boolean | undefined;
  /**
   * Determines which axis the tooltip should track the cursor on.
   * @default 'none'
   */
  trackCursorAxis?: 'none' | 'x' | 'y' | 'both' | undefined;
  /**
   * A ref to imperative actions: a ref object (`{ current: null }`) or a callback receiving them (and `null` on unmount).
   * - `unmount`: Ends the closing phase of the tooltip after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `onOpenChange` first, otherwise the tooltip completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the tooltip imperatively when called.
   */
  actionsRef?: ActionsRef<TooltipRoot.Actions> | undefined;
  /**
   * Whether the tooltip is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the tooltip with a trigger.
   * If specified, allows external triggers to control the tooltip's open state.
   * Can be created with the Tooltip.createHandle() method.
   */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * The content of the tooltip.
   * This can be regular elements or a function that receives the `payload` of the active trigger
   * (called once; `payload` is a live getter).
   */
  children?: JSX.Element | PayloadChildRenderFunction<Payload>;
  /**
   * ID of the trigger that the tooltip is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled tooltip.
   * There's no need to specify this prop when the tooltip is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the tooltip is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open tooltip.
   */
  defaultTriggerId?: string | null | undefined;
}

export interface TooltipRootActions {
  unmount: () => void;
  close: () => void;
}

export type TooltipRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.disabled
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type TooltipRootChangeEventDetails =
  BaseUIChangeEventDetails<TooltipRoot.ChangeEventReason> & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };

export namespace TooltipRoot {
  export type State = TooltipRootState;
  export type Props<Payload = unknown> = TooltipRootProps<Payload>;
  export type Actions = TooltipRootActions;
  export type ChangeEventReason = TooltipRootChangeEventReason;
  export type ChangeEventDetails = TooltipRootChangeEventDetails;
}
