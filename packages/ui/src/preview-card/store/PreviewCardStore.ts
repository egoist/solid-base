import { NOOP } from '@egoist/solid-base-utils/empty';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type {
  PopupStoreContext,
  PopupStoreState,
  PopupTriggerDataStore,
} from '../../utils/popups/store';
import { updateInlineRectCoords } from '../../utils/popups/inlineRect';
import type { InlineRectCoords } from '../../utils/popups/inlineRect';
import {
  BasePopupStore,
  createInitialPopupStoreState,
  createPopupStoreContext,
  getHoverPopupInstantType,
  popupStoreSelectors,
} from '../../utils/popups/store';
import type { PreviewCardRoot } from '../root/PreviewCardRoot';
import { REASONS } from '../../internals/reasons';
import { NullStore } from '../../utils/popups/NullStore';
import { CLOSE_DELAY } from '../utils/constants';
import type { AdaptiveOriginMiddleware } from '../../utils/popups/positioning/adaptiveOriginConstants';

export type PreviewCardInstantType = 'dismiss' | 'focus' | undefined;

export type State<Payload> = PopupStoreState<Payload> & {
  instantType: PreviewCardInstantType;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
  closeDelay: number;
};

export type Context = PopupStoreContext<PreviewCardRoot.ChangeEventDetails> & {
  readonly inlineRectCoordsRef: RefObject<InlineRectCoords | undefined>;
};

type S = State<unknown>;

const selectors = {
  ...popupStoreSelectors,
  instantType: (state: S) => state.instantType,
  adaptiveOrigin: (state: S): AdaptiveOriginMiddleware | undefined => state.adaptiveOrigin,
  closeDelay: (state: S) => state.closeDelay,
};

type Selectors = typeof selectors;

/**
 * The store view that detached handle-backed triggers read from. Both the real `PreviewCardStore`
 * and the inert fallback store satisfy it.
 */
export type PreviewCardHandleStore<Payload> = PopupTriggerDataStore<State<Payload>> &
  Pick<PreviewCardStore<Payload>, 'setOpen' | 'context' | 'select'>;

export class PreviewCardStore<Payload> extends BasePopupStore<
  State<Payload>,
  Context,
  Selectors,
  PreviewCardRoot.ChangeEventDetails
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
    eventDetails: PreviewCardRoot.ChangeEventDetails,
  ) {
    const { inlineRectCoordsRef } = this.context;

    // Capture the hovered inline-rect coordinates so the card anchors to the
    // exact point on the link that was hovered.
    const event = eventDetails.event as Event | undefined;
    if (
      nextOpen &&
      eventDetails.reason === REASONS.triggerHover &&
      eventDetails.trigger &&
      event &&
      'clientX' in event &&
      'clientY' in event &&
      inlineRectCoordsRef.current?.element !== eventDetails.trigger
    ) {
      updateInlineRectCoords(
        inlineRectCoordsRef,
        eventDetails.trigger,
        (event as MouseEvent).clientX,
        (event as MouseEvent).clientY,
      );
    }

    return getHoverPopupInstantType(nextOpen, eventDetails.reason) as Partial<State<Payload>>;
  }

  protected override prepareUnmount() {
    this.context.inlineRectCoordsRef.current = undefined;
    return {};
  }
}

/**
 * Creates the inert fallback store used by detached handle-backed triggers while no
 * `PreviewCard.Root` is attached. `setOpen` is a no-op.
 */
export function createNullPreviewCardStore<Payload>(): PreviewCardHandleStore<Payload> {
  const store = new NullStore<State<Payload>, Context, Selectors>(
    createInitialState<Payload>(undefined),
    createInitialContext(),
    selectors,
  );
  return Object.assign(store, { setOpen: NOOP }) as unknown as PreviewCardHandleStore<Payload>;
}

function createInitialState<Payload>(
  initialState: Partial<State<Payload>> | undefined,
  defaultPopupId?: string | undefined,
): State<Payload> {
  return {
    ...createInitialPopupStoreState<Payload>(defaultPopupId),
    instantType: undefined,
    adaptiveOrigin: undefined,
    closeDelay: CLOSE_DELAY,
    ...initialState,
  };
}

function createInitialContext(): Context {
  return {
    ...createPopupStoreContext(),
    inlineRectCoordsRef: { current: undefined },
  };
}
