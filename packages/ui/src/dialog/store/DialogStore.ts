import { NOOP } from '@egoist/solid-base-utils/empty';
import type { InteractionType } from '../../utils/popups/interactions/enhancedClickHandler';
import type { DialogRoot } from '../root/DialogRoot';
import { NullStore } from '../../utils/popups/NullStore';
import type {
  PopupStoreContext,
  PopupTriggerDataStore,
  PopupStoreState,
} from '../../utils/popups/store';
import {
  BasePopupStore,
  createInitialPopupStoreState,
  createPopupStoreContext,
  popupStoreSelectors,
} from '../../utils/popups/store';

export type State<Payload> = PopupStoreState<Payload> & {
  modal: boolean | 'trap-focus';
  disablePointerDismissal: boolean;
  openMethod: InteractionType | null;
  nested: boolean;
  nestedOpenDialogCount: number;
  nestedOpenDrawerCount: number;
  titleElementId: string | undefined;
  descriptionElementId: string | undefined;
  viewportElement: HTMLElement | null;
  role: 'dialog' | 'alertdialog';
};

type Context = PopupStoreContext<DialogRoot.ChangeEventDetails> & {
  /** The `Dialog.Backdrop` element. */
  backdropElement: HTMLElement | null;
  /** The internal backdrop a modal dialog renders in its portal. */
  internalBackdropElement: HTMLElement | null;
  /** Whether outside presses may close the dialog (Drawer turns it off while swiping). */
  outsidePressEnabled: boolean;
  /** Set by a Root so its nested Roots can report their open dialogs and drawers. */
  onNestedDialogOpen?: ((dialogCount: number, drawerCount: number) => void) | undefined;
};

type S = State<unknown>;

const selectors = {
  ...popupStoreSelectors,
  modal: (state: S) => state.modal,
  nested: (state: S) => state.nested,
  nestedOpenDialogCount: (state: S) => state.nestedOpenDialogCount,
  nestedOpenDrawerCount: (state: S) => state.nestedOpenDrawerCount,
  disablePointerDismissal: (state: S) => state.disablePointerDismissal,
  openMethod: (state: S) => state.openMethod,
  descriptionElementId: (state: S) => state.descriptionElementId,
  titleElementId: (state: S) => state.titleElementId,
  viewportElement: (state: S) => state.viewportElement,
  role: (state: S) => state.role,
  // Dialogs aren't anchored, so their popup acts as their positioner.
  positionerElement: (state: S) => state.popupElement,
};

/**
 * The subset of `DialogStore` that detached handle-backed triggers rely on. Both the real
 * `DialogStore` and the inert fallback store satisfy it.
 */
export type DialogHandleStore<Payload> = PopupTriggerDataStore<State<Payload>> &
  Pick<DialogStore<Payload>, 'setOpen' | 'context'>;

export class DialogStore<Payload> extends BasePopupStore<
  State<Payload>,
  Context,
  typeof selectors,
  DialogRoot.ChangeEventDetails
> {
  constructor(
    initialState: Partial<State<Payload>> | undefined,
    defaultPopupId: string | undefined,
  ) {
    super(createInitialState<Payload>(initialState, defaultPopupId), createInitialContext(), selectors);
  }
}

/**
 * Creates the inert fallback store used by detached handle-backed triggers while no
 * `Dialog.Root` is attached. It keeps a trigger registry in its context so detached triggers can
 * register before migrating to the live root store.
 */
export function createNullDialogStore<Payload>(): DialogHandleStore<Payload> {
  const store = new NullStore<State<Payload>, Context, typeof selectors>(
    createInitialState<Payload>(undefined),
    createInitialContext(),
    selectors,
  );
  return Object.assign(store, { setOpen: NOOP }) as unknown as DialogHandleStore<Payload>;
}

function createInitialState<Payload>(
  initialState: Partial<State<Payload>> | undefined,
  defaultPopupId?: string | undefined,
): State<Payload> {
  return {
    ...createInitialPopupStoreState<Payload>(defaultPopupId),
    modal: true,
    disablePointerDismissal: false,
    viewportElement: null,
    descriptionElementId: undefined,
    titleElementId: undefined,
    openMethod: null,
    nested: false,
    nestedOpenDialogCount: 0,
    nestedOpenDrawerCount: 0,
    role: 'dialog',
    ...initialState,
  };
}

function createInitialContext(): Context {
  return {
    ...createPopupStoreContext(),
    backdropElement: null,
    internalBackdropElement: null,
    outsidePressEnabled: true,
  };
}
