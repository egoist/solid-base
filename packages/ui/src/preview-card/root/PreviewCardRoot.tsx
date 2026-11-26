import type { JSX } from '@solidjs/web';
import { createDismiss } from '../../utils/popups/interactions/dismiss';
import { FloatingTree } from '../../utils/popups/tree/FloatingTree';
import { PreviewCardRootContext, usePreviewCardRootContext } from './PreviewCardContext';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';
import { PreviewCardStore } from '../store/PreviewCardStore';
import type { ActionsRef, PayloadChildRenderFunction } from '../../utils/popups/popupRoot';
import {
  attachPopupHandle,
  createPopupRoot,
  renderPopupRootChildren,
} from '../../utils/popups/popupRoot';
import {
  createPopupInteractionProps,
  deriveActiveTriggerState,
} from '../../utils/popups/popupStoreUtils';
import type { PreviewCardHandle } from '../store/PreviewCardHandle';

function PreviewCardRootComponent<Payload>(props: PreviewCardRoot.Props<Payload>): JSX.Element {
  const { store } = createPopupRoot(
    props,
    (initialState, defaultPopupId) => new PreviewCardStore<Payload>(initialState, defaultPopupId),
    { closeOnActiveTriggerUnmount: true },
  );

  // The payload and the close delay come from the active trigger. A preview card open (or closing)
  // without an active trigger has no payload.
  deriveActiveTriggerState(store, ['payload', 'closeDelay'], { clearWithoutTrigger: ['payload'] });

  // Attached before the children render; a new `handle` prop re-attaches the same store.
  attachPopupHandle(() => props.handle, store);

  const dismiss = createDismiss(store);

  // `dismiss.trigger` is the same object as `dismiss.reference`.
  createPopupInteractionProps(store, {
    activeTriggerProps: dismiss.reference!,
    inactiveTriggerProps: dismiss.trigger!,
    popupProps: dismiss.floating!,
  });

  return (
    <PreviewCardRootContext value={store as PreviewCardStore<unknown>}>
      {renderPopupRootChildren<Payload>(
        props.children,
        () => store.select('payload') as Payload | undefined,
      )}
    </PreviewCardRootContext>
  );
}

/**
 * Groups all parts of the preview card.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Solid Base Preview Card](https://base.egoist.dev/components/preview-card)
 */
export function PreviewCardRoot<Payload = unknown>(
  props: PreviewCardRoot.Props<Payload>,
): JSX.Element {
  if (usePreviewCardRootContext(true)) {
    return <PreviewCardRootComponent {...props} />;
  }

  return (
    <FloatingTree>
      <PreviewCardRootComponent {...props} />
    </FloatingTree>
  );
}

export interface PreviewCardRootState {}

export interface PreviewCardRootProps<Payload = unknown> {
  /**
   * Whether the preview card is initially open.
   *
   * To render a controlled preview card, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the preview card is currently open.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the preview card is opened or closed.
   */
  onOpenChange?:
    | ((open: boolean, eventDetails: PreviewCardRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * Event handler called after any animations complete when the preview card is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * A ref to imperative actions: a ref object (`{ current: null }`) or a callback receiving them (and `null` on unmount).
   * - `unmount`: Ends the closing phase of the preview card after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `onOpenChange` first, otherwise the preview card completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the preview card imperatively when called.
   */
  actionsRef?: ActionsRef<PreviewCardRoot.Actions> | undefined;
  /**
   * A handle to associate the preview card with a trigger.
   * If specified, allows external triggers to control the card's open state.
   * Can be created with the PreviewCard.createHandle() method.
   */
  handle?: PreviewCardHandle<Payload> | undefined;
  /**
   * The content of the preview card.
   * This can be regular elements or a function that receives the `payload` of the active trigger
   * (called once; `payload` is a live getter).
   */
  children?: JSX.Element | PayloadChildRenderFunction<Payload>;
  /**
   * ID of the trigger that the preview card is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled preview card.
   * There's no need to specify this prop when the preview card is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the preview card is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open preview card.
   */
  defaultTriggerId?: string | null | undefined;
}

export interface PreviewCardRootActions {
  unmount: () => void;
  close: () => void;
}

export type PreviewCardRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type PreviewCardRootChangeEventDetails =
  BaseUIChangeEventDetails<PreviewCardRoot.ChangeEventReason> & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };

export namespace PreviewCardRoot {
  export type State = PreviewCardRootState;
  export type Props<Payload = unknown> = PreviewCardRootProps<Payload>;
  export type Actions = PreviewCardRootActions;
  export type ChangeEventReason = PreviewCardRootChangeEventReason;
  export type ChangeEventDetails = PreviewCardRootChangeEventDetails;
}
