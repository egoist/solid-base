import { NOOP } from '@egoist/solid-base-utils/empty';
import { Timeout } from '@egoist/solid-base-utils/timeout';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { InteractionType } from '../../utils/popups/interactions/enhancedClickHandler';
import type { PopoverRoot } from '../root/PopoverRoot';
import { REASONS } from '../../internals/reasons';
import { NullStore } from '../../utils/popups/NullStore';
import type {
  PopupStoreContext,
  PopupStoreState,
  PopupTriggerDataStore,
} from '../../utils/popups/store';
import {
  BasePopupStore,
  createInitialPopupStoreState,
  createPopupStoreContext,
  popupStoreSelectors,
} from '../../utils/popups/store';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import type { AdaptiveOriginMiddleware } from '../../utils/popups/positioning/adaptiveOriginConstants';

export type PopoverInstantType = 'dismiss' | 'click' | 'focus' | 'trigger-change' | undefined;

export type State<Payload> = PopupStoreState<Payload> & {
  disabled: boolean;
  instantType: PopoverInstantType;
  modal: boolean | 'trap-focus';
  focusManagerModal: boolean;
  openMethod: InteractionType | null;
  openChangeReason: PopoverRoot.ChangeEventReason | null;
  titleElementId: string | undefined;
  descriptionElementId: string | undefined;
  openOnHover: boolean;
  closeDelay: number;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

export type Context = PopupStoreContext<PopoverRoot.ChangeEventDetails> & {
  readonly triggerFocusTargetRef: RefObject<HTMLElement | null>;
  readonly beforeTriggerFocusGuardRef: RefObject<HTMLElement | null>;
  readonly beforeContentFocusGuardRef: RefObject<HTMLElement | null>;
  readonly stickIfOpenTimeout: Timeout;
  // Only read when a trigger is pressed, so it isn't reactive state.
  stickIfOpen: boolean;
};

type S = State<unknown>;

const selectors = {
  ...popupStoreSelectors,
  disabled: (state: S) => state.disabled,
  // `trigger-change` describes a popup moving between triggers, which only has meaning while it
  // is open. Dropping it once closed keeps a late or stale restoration from marking a closing
  // popup instant and skipping its exit transition, including on close paths that never reach
  // `setOpen` — a controlled consumer committing `open={false}` goes straight through the prop.
  instantType: (state: S): PopoverInstantType =>
    state.instantType === 'trigger-change' && !popupStoreSelectors.open(state)
      ? undefined
      : state.instantType,
  openMethod: (state: S) => state.openMethod,
  openChangeReason: (state: S) => state.openChangeReason,
  isPressOpenedByTrigger: (state: S, triggerId: string | undefined) =>
    state.openChangeReason === REASONS.triggerPress &&
    popupStoreSelectors.isOpenedByTrigger(state, triggerId),
  isTouchPressOpen: (state: S, openOnHover: boolean) =>
    openOnHover && state.openMethod === 'touch' && state.openChangeReason === REASONS.triggerPress,
  // A hover-opened popover disables its focus manager, so there's nothing for the guards to
  // forward focus to; native tab order applies instead.
  hasTriggerFocusGuards: (state: S, triggerId: string | undefined) =>
    popupStoreSelectors.isOpenedByTrigger(state, triggerId) &&
    !state.focusManagerModal &&
    state.openChangeReason !== REASONS.triggerHover,
  modal: (state: S) => state.modal,
  focusManagerModal: (state: S) => state.focusManagerModal,
  titleElementId: (state: S) => state.titleElementId,
  descriptionElementId: (state: S) => state.descriptionElementId,
  openOnHover: (state: S) => state.openOnHover,
  closeDelay: (state: S) => state.closeDelay,
  adaptiveOrigin: (state: S): AdaptiveOriginMiddleware | undefined => state.adaptiveOrigin,
};

type Selectors = typeof selectors;

/**
 * The store view that detached handle-backed triggers read from. Both the real `PopoverStore` and
 * the inert fallback store satisfy it.
 */
export type PopoverHandleStore<Payload> = PopupTriggerDataStore<State<Payload>> &
  Pick<PopoverStore<Payload>, 'setOpen' | 'context' | 'select'>;

export class PopoverStore<Payload> extends BasePopupStore<
  State<Payload>,
  Context,
  Selectors,
  PopoverRoot.ChangeEventDetails
> {
  constructor(initialState: Partial<State<Payload>> | undefined, defaultPopupId: string | undefined) {
    super(
      createInitialState<Payload>(initialState, defaultPopupId),
      createInitialContext(),
      selectors,
    );
  }

  protected override prepareOpenChange(
    nextOpen: boolean,
    eventDetails: PopoverRoot.ChangeEventDetails,
  ) {
    const reason = eventDetails.reason;

    if (reason === REASONS.triggerHover) {
      // Only allow "patient" clicks to close the popover if it's open.
      // If they clicked within 500ms of the popover opening, keep it open.
      this.context.stickIfOpen = true;
      this.context.stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
        this.context.stickIfOpen = false;
      });
    }

    let instantType: PopoverInstantType;
    if (reason === REASONS.triggerPress && (eventDetails.event as MouseEvent | undefined)?.detail === 0) {
      instantType = 'click';
    } else if (!nextOpen && (reason === REASONS.escapeKey || reason == null)) {
      instantType = 'dismiss';
    } else if (reason === REASONS.focusOut) {
      instantType = 'focus';
    }

    return { instantType } as Partial<State<Payload>>;
  }

  protected override prepareUnmount() {
    this.context.stickIfOpen = true;
    return { openChangeReason: null } as Partial<State<Payload>>;
  }
}

/**
 * Creates the inert fallback store used by detached handle-backed triggers while no
 * `Popover.Root` is attached. `setOpen` is a no-op.
 */
export function createNullPopoverStore<Payload>(): PopoverHandleStore<Payload> {
  const store = new NullStore<State<Payload>, Context, Selectors>(
    createInitialState<Payload>(undefined),
    createInitialContext(),
    selectors,
  );
  return Object.assign(store, { setOpen: NOOP }) as unknown as PopoverHandleStore<Payload>;
}

function createInitialState<Payload>(
  initialState: Partial<State<Payload>> | undefined,
  defaultPopupId?: string | undefined,
): State<Payload> {
  return {
    ...createInitialPopupStoreState<Payload>(defaultPopupId),
    disabled: false,
    modal: false,
    focusManagerModal: false,
    instantType: undefined,
    openMethod: null,
    openChangeReason: null,
    titleElementId: undefined,
    descriptionElementId: undefined,
    openOnHover: false,
    closeDelay: 0,
    adaptiveOrigin: undefined,
    ...initialState,
  };
}

function createInitialContext(): Context {
  return {
    ...createPopupStoreContext(),
    triggerFocusTargetRef: { current: null },
    beforeTriggerFocusGuardRef: { current: null },
    beforeContentFocusGuardRef: { current: null },
    stickIfOpenTimeout: new Timeout(),
    stickIfOpen: true,
  };
}
