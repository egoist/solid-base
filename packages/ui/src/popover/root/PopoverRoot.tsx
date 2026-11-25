import { createEffect, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createDismiss } from '../../utils/popups/interactions/dismiss';
import { FloatingTree } from '../../utils/popups/tree/FloatingTree';
import { PopoverRootContext, usePopoverRootContext } from './PopoverRootContext';
import { PopoverStore } from '../store/PopoverStore';
import type { PopoverHandle } from '../store/PopoverHandle';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';
import {
  attachPopupHandle,
  createPopupRoot,
  createPopupRootSync,
  renderPopupRootChildren,
} from '../../utils/popups/popupRoot';
import type { ActionsRef, PayloadChildRenderFunction } from '../../utils/popups/popupRoot';
import { createPopupInteractionProps } from '../../utils/popups/popupStoreUtils';

function PopoverRootComponent<Payload>(props: PopoverRoot.Props<Payload>): JSX.Element {
  const { store, open } = createPopupRoot(
    props,
    (initialState, defaultPopupId) =>
      new PopoverStore<Payload>(
        { ...initialState, modal: untrack(() => props.modal) ?? false },
        defaultPopupId,
      ),
  );

  store.bind('modal', () => props.modal ?? false);

  // Dispose the patient-click timeout held in the store's context on unmount.
  onCleanup(store.context.stickIfOpenTimeout.clear);

  createPopupRootSync(store, open);

  createEffect(open, (isOpen) => {
    if (!isOpen) {
      store.context.stickIfOpenTimeout.clear();
    }
  });

  // Attached before the children render; a new `handle` prop re-attaches the same store.
  attachPopupHandle(() => props.handle, store);

  createPopoverInteractions(store);

  return (
    <PopoverRootContext value={store as PopoverStore<unknown>}>
      {renderPopupRootChildren<Payload>(
        props.children,
        () => store.select('payload') as Payload | undefined,
      )}
    </PopoverRootContext>
  );
}

function createPopoverInteractions(store: PopoverStore<any>) {
  const dismiss = createDismiss(store, {
    get outsidePressEvent() {
      return {
        // Ensure `aria-hidden` on outside elements is removed immediately
        // on outside press when trapping focus.
        mouse: store.select('modal') === 'trap-focus' ? 'sloppy' : 'intentional',
        touch: 'sloppy',
      } as const;
    },
  });

  // `dismiss.trigger` is always the same object as `dismiss.reference`.
  // PopoverPopup spreads `FOCUSABLE_POPUP_PROPS` itself, so the popup props only need to carry
  // the dismiss handlers.
  createPopupInteractionProps(store, {
    activeTriggerProps: dismiss.reference!,
    inactiveTriggerProps: dismiss.reference!,
    popupProps: dismiss.floating!,
  });
}

/**
 * Groups all parts of the popover.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export function PopoverRoot<Payload = unknown>(props: PopoverRoot.Props<Payload>): JSX.Element {
  if (usePopoverRootContext(true)) {
    return <PopoverRootComponent {...props} />;
  }

  return (
    <FloatingTree>
      <PopoverRootComponent {...props} />
    </FloatingTree>
  );
}

export interface PopoverRootState {}

export interface PopoverRootProps<Payload = unknown> {
  /**
   * Whether the popover is initially open.
   *
   * To render a controlled popover, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the popover is currently open.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the popover is opened or closed.
   */
  onOpenChange?:
    | ((open: boolean, eventDetails: PopoverRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * Event handler called after any animations complete when the popover is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * A ref to imperative actions: a ref object (`{ current: null }`) or a callback receiving them (and `null` on unmount).
   * - `unmount`: Ends the closing phase of the popover after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `onOpenChange` first, otherwise the popover completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the popover imperatively when called.
   */
  actionsRef?: ActionsRef<PopoverRoot.Actions> | undefined;
  /**
   * Determines if the popover enters a modal state when open.
   * - `true`: user interaction is limited to the popover: document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the popover, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   *
   * When `modal` is `true`, focus trapping is enabled only if `<Popover.Close>` is rendered
   * inside `<Popover.Popup>`. It can be visually hidden with your own CSS if needed, such as
   * Tailwind's `sr-only` utility.
   *
   * When `modal` is `'trap-focus'`, render `<Popover.Close>` inside `<Popover.Popup>` so touch
   * screen readers can escape the popup.
   * @default false
   */
  modal?: boolean | 'trap-focus' | undefined;
  /**
   * ID of the trigger that the popover is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled popover.
   * There's no need to specify this prop when the popover is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the popover is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open popover.
   */
  defaultTriggerId?: string | null | undefined;
  /**
   * A handle to associate the popover with a trigger.
   * If specified, allows external triggers to control the popover's open state.
   */
  handle?: PopoverHandle<Payload> | undefined;
  /**
   * The content of the popover.
   * This can be regular elements or a function that receives the `payload` of the active trigger
   * (called once; `payload` is a live getter).
   */
  children?: JSX.Element | PayloadChildRenderFunction<Payload>;
}

export interface PopoverRootActions {
  unmount: () => void;
  close: () => void;
}

export type PopoverRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type PopoverRootChangeEventDetails =
  BaseUIChangeEventDetails<PopoverRoot.ChangeEventReason> & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };

export namespace PopoverRoot {
  export type State = PopoverRootState;
  export type Props<Payload = unknown> = PopoverRootProps<Payload>;
  export type Actions = PopoverRootActions;
  export type ChangeEventReason = PopoverRootChangeEventReason;
  export type ChangeEventDetails = PopoverRootChangeEventDetails;
}
