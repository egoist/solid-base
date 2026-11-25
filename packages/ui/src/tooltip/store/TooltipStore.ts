import { NOOP } from '@egoist/solid-base-utils/empty';
import type { TooltipRoot } from '../root/TooltipRoot';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { NullStore } from '../../utils/popups/NullStore';
import type { AdaptiveOriginMiddleware } from '../../utils/popups/positioning/adaptiveOriginConstants';
import { dispatchOpenChange } from '../../utils/popups/floating-root/dispatchOpenChange';
import type {
  PopupStoreContext,
  PopupStoreState,
  PopupTriggerDataStore,
} from '../../utils/popups/store';
import {
  BasePopupStore,
  createInitialPopupStoreState,
  createPopupStoreContext,
  getHoverPopupInstantType,
  popupStoreSelectors,
} from '../../utils/popups/store';

export type TooltipInstantType = 'delay' | 'dismiss' | 'focus' | undefined;

export type State<Payload> = PopupStoreState<Payload> & {
  disabled: boolean;
  instantType: TooltipInstantType;
  isInstantPhase: boolean;
  trackCursorAxis: 'none' | 'x' | 'y' | 'both';
  disableHoverablePopup: boolean;
  openChangeReason: TooltipRoot.ChangeEventReason | null;
  closeOnClick: boolean;
  closeDelay: number;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

export type Context = PopupStoreContext<TooltipRoot.ChangeEventDetails>;

type S = State<unknown>;

const selectors = {
  ...popupStoreSelectors,
  // A disabled tooltip renders as closed while its open state is kept (it reopens when re-enabled
  // if the close request was canceled), so its triggers aren't open. `disabled` is read first:
  // the triggers don't depend on the open state while it's disabled, and the close request
  // committed then doesn't re-run them.
  isOpenedByTrigger: (state: S, triggerId: string | undefined) =>
    !state.disabled && popupStoreSelectors.isOpenedByTrigger(state, triggerId),
  triggerPopupId: (state: S, triggerId: string | undefined) =>
    state.disabled ? undefined : popupStoreSelectors.triggerPopupId(state, triggerId),
  disabled: (state: S) => state.disabled,
  instantType: (state: S) => state.instantType,
  isInstantPhase: (state: S) => state.isInstantPhase,
  trackCursorAxis: (state: S) => state.trackCursorAxis,
  disableHoverablePopup: (state: S) => state.disableHoverablePopup,
  lastOpenChangeReason: (state: S) => state.openChangeReason,
  closeOnClick: (state: S) => state.closeOnClick,
  // Active and inactive trigger props are the same object.
  appliedTriggerProps: (state: S, apply: boolean) =>
    apply ? state.activeTriggerProps : undefined,
  closeDelay: (state: S) => state.closeDelay,
  adaptiveOrigin: (state: S): AdaptiveOriginMiddleware | undefined => state.adaptiveOrigin,
};

type Selectors = typeof selectors;

/**
 * The store view that detached handle-backed triggers read from. Both the real `TooltipStore` and
 * the inert fallback store satisfy it.
 */
export type TooltipHandleStore<Payload> = PopupTriggerDataStore<State<Payload>> &
  Pick<
    TooltipStore<Payload>,
    'setOpen' | 'cancelPendingOpen' | 'closeForSibling' | 'context' | 'select'
  >;

export class TooltipStore<Payload> extends BasePopupStore<
  State<Payload>,
  Context,
  Selectors,
  TooltipRoot.ChangeEventDetails
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
    eventDetails: TooltipRoot.ChangeEventDetails,
  ) {
    return getHoverPopupInstantType(nextOpen, eventDetails.reason) as Partial<State<Payload>>;
  }

  /**
   * Closes the tooltip because another tooltip in its delay group opened. A tooltip that is already
   * closing records the reason instead, so `Tooltip.Root` skips the rest of its exit transition.
   */
  closeForSibling = () => {
    if (!this.select('open') && this.state.mounted) {
      this.set('openChangeReason', REASONS.none);
    }
    this.setOpen(false, createChangeEventDetails(REASONS.none));
  };

  /**
   * Used by trigger clicks to clear a delayed hover open without reporting a public open-state
   * change.
   */
  cancelPendingOpen(event: MouseEvent | PointerEvent) {
    dispatchOpenChange(
      this.context,
      this.select('open'),
      false,
      createChangeEventDetails(REASONS.triggerPress, event),
    );
  }
}

/**
 * Creates the inert fallback store used by detached handle-backed triggers while no `Tooltip.Root`
 * is attached. `setOpen`, `cancelPendingOpen` and `closeForSibling` are no-ops.
 */
export function createNullTooltipStore<Payload>(): TooltipHandleStore<Payload> {
  const store = new NullStore<State<Payload>, Context, Selectors>(
    createInitialState<Payload>(undefined),
    createInitialContext(),
    selectors,
  );
  return Object.assign(store, {
    setOpen: NOOP,
    cancelPendingOpen: NOOP,
    closeForSibling: NOOP,
  }) as unknown as TooltipHandleStore<Payload>;
}

function createInitialState<Payload>(
  initialState: Partial<State<Payload>> | undefined,
  defaultPopupId?: string | undefined,
): State<Payload> {
  return {
    ...createInitialPopupStoreState<Payload>(defaultPopupId),
    disabled: false,
    instantType: undefined,
    isInstantPhase: false,
    trackCursorAxis: 'none',
    disableHoverablePopup: false,
    openChangeReason: null,
    closeOnClick: true,
    closeDelay: 0,
    adaptiveOrigin: undefined,
    ...initialState,
  };
}

function createInitialContext(): Context {
  return createPopupStoreContext();
}
