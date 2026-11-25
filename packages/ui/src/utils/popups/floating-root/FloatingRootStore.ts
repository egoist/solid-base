import { ReactiveStore } from '../reactiveStore';
import type { PopupInteractionContext, PositioningInteractionStore, ReferenceType } from '../types';
import type { BaseUIChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { createEventEmitter } from '../createEventEmitter';
import type { PopupTriggerMap } from '../popupTriggerMap';
import { dispatchOpenChange } from './dispatchOpenChange';
import type { TransitionStatus } from '../../../internals/transitionStatus';

/**
 * The state of a `FloatingRootStore`, synced from the component that owns it.
 */
export interface FloatingRootState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * The popup's open or close transition. Owners don't sync it, so it stays `undefined`.
   */
  transitionStatus: TransitionStatus | undefined;
  /**
   * The anchor element the owner passes, usually its trigger.
   */
  anchorElement: Element | null;
  /**
   * The popup's positioner element, or the popup itself when it has no positioner.
   */
  positionerElement: HTMLElement | null;
  /**
   * An anchor set explicitly, such as the cursor position of a popup that follows it.
   */
  anchorOverride: ReferenceType | null;
  /**
   * The popup's id unless its element sets one.
   */
  defaultPopupId: string | undefined;
}

/**
 * The non-reactive context of a `FloatingRootStore`: what the interactions share, plus the
 * owner's open change callback.
 */
export interface FloatingRootStoreContext extends PopupInteractionContext {
  /**
   * Called after an open change is dispatched to the interactions, so the owner can update its
   * own open state.
   */
  onOpenChange:
    | ((open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void)
    | undefined;
}

const selectors = {
  open: (state: FloatingRootState) => state.open,
  transitionStatus: (state: FloatingRootState) => state.transitionStatus,
  anchorElement: (state: FloatingRootState) => state.anchorElement,
  anchor: (state: FloatingRootState) => state.anchorOverride ?? state.anchorElement,
  positionerElement: (state: FloatingRootState) => state.positionerElement,
  defaultPopupId: (state: FloatingRootState) => state.defaultPopupId,
};

export interface FloatingRootStoreOptions {
  open: boolean;
  anchorElement: Element | null;
  positionerElement: HTMLElement | null;
  triggerElements: PopupTriggerMap;
  defaultPopupId: string | undefined;
  nested: boolean;
  onOpenChange:
    | ((open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void)
    | undefined;
}

/**
 * An interaction store for components without a popup store: Navigation Menu and Toast. It holds
 * the open state, anchor and elements of its owner (bind them to accessors with `bind`, or use
 * `createFloatingRootStore`), and reports open changes back through `onOpenChange`.
 */
export class FloatingRootStore
  extends ReactiveStore<FloatingRootState, FloatingRootStoreContext, typeof selectors>
  implements PositioningInteractionStore
{
  constructor(options: FloatingRootStoreOptions) {
    const { nested, onOpenChange, triggerElements, ...initialState } = options;

    super(
      { ...initialState, transitionStatus: undefined, anchorOverride: null },
      {
        onOpenChange,
        events: createEventEmitter(),
        nested,
        triggerElements,
      },
      selectors,
    );
  }

  /**
   * Emits the `openchange` event and calls the `onOpenChange` handler.
   */
  setOpen = (newOpen: boolean, eventDetails: BaseUIChangeEventDetails<string>) => {
    dispatchOpenChange(this.context, this.state.open, newOpen, eventDetails);
    this.context.onOpenChange?.(newOpen, eventDetails);
  };

  /**
   * Forgets the anchor and elements positioning reads while the popup isn't mounted.
   */
  clearPositioning() {
    this.update({
      positionerElement: null,
      anchorElement: null,
      anchorOverride: null,
    });
  }
}
