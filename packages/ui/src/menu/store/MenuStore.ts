import { EMPTY_OBJECT, NOOP } from '@egoist/solid-base-utils/empty';
import { platform } from '@egoist/solid-base-utils/platform';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { Timeout } from '@egoist/solid-base-utils/timeout';
import type { InteractionType } from '../../utils/popups/interactions/enhancedClickHandler';
import type { MenuParent, MenuRoot } from '../root/MenuRoot';
import { FloatingTreeStore } from '../../utils/popups/tree/FloatingTreeStore';
import type { HTMLProps } from '../../internals/types';
import { NullStore } from '../../utils/popups/NullStore';
import type { AdaptiveOriginMiddleware } from '../../utils/popups/positioning/adaptiveOriginConstants';
import { REASONS } from '../../internals/reasons';
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
import { isKeyboardClick, isKeyboardOpen } from '../utils/isKeyboardOpen';

export type MenuInstantType = 'dismiss' | 'click' | 'group' | 'trigger-change' | undefined;

export type State<Payload> = PopupStoreState<Payload> & {
  disabled: boolean;
  modal: boolean | undefined;
  openMethod: InteractionType | null;
  /** Whether the popup last opened from the keyboard or an assistive-technology press. */
  keyboardOpen: boolean;
  allowMouseEnter: boolean;
  highlightItemOnHover: boolean;
  parent: MenuParent;
  rootId: string | undefined;
  activeIndex: number | null;
  /** The `Menu.List` element, which takes the `menu` role from the popup when rendered. */
  listElement: HTMLElement | null;
  /**
   * Props a filter root adds to its triggers (dialog semantics and the key relay to the input).
   * Published by the filter implementation so a plain menu never bundles them.
   */
  filterTriggerProps: HTMLProps;
  /** List navigation props for the element that holds real focus under virtual focus. */
  inputProps: HTMLProps;
  /** Whether this menu's filter input has focus. */
  inputFocused: boolean;
  /** The element at `activeIndex` once the item list settles. Only virtual focus publishes it. */
  highlightedItem: HTMLElement | undefined;
  hoverEnabled: boolean;
  instantType: MenuInstantType;
  openChangeReason: MenuRoot.ChangeEventReason | null;
  floatingTreeRoot: FloatingTreeStore;
  floatingNodeId: string | undefined;
  floatingParentNodeId: string | null;
  itemProps: HTMLProps;
  closeDelay: number;
  keyboardEventRelay: ((event: KeyboardEvent) => void) | undefined;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

export type MenuStoreContext = PopupStoreContext<MenuRoot.ChangeEventDetails> & {
  readonly typingRef: RefObject<boolean>;
  readonly itemDomElements: RefObject<Array<HTMLElement | null>>;
  readonly itemLabels: RefObject<Array<string | null>>;
  /** Why the next `activeIndex` write happens, consumed by `onItemHighlighted` on commit. */
  highlightReason: MenuRoot.HighlightEventReason;
  /** The event that caused the next `activeIndex` write, reported along with `highlightReason`. */
  highlightEvent: Event | undefined;
  /** The item last committed as highlighted, kept in every menu so reasons compare against it. */
  reportedItem: HTMLElement | undefined;
  /**
   * Whether a mouse-up over an item activates it (a press that started on the trigger). Shared
   * with the parent menu, menubar or context menu.
   */
  readonly allowMouseUpTriggerRef: RefObject<boolean>;
  /** The element that holds real focus while virtual list navigation is active. */
  virtualFocusRef: RefObject<HTMLElement | null> | undefined;
  /** Whether a filterable menu's trigger was last pressed by a screen reader. */
  virtualPress?: boolean | undefined;
  readonly triggerFocusTargetRef: RefObject<HTMLElement | null>;
  readonly beforeTriggerFocusGuardRef: RefObject<HTMLElement | null>;
  readonly beforeContentFocusGuardRef: RefObject<HTMLElement | null>;
  /**
   * The event of the menu's last open change, unlike `openEvent`, which keeps the event of a
   * click open when a hover open follows. Cleared once the menu is closed.
   */
  lastOpenChangeEvent: Event | undefined;
  /**
   * Whether a touch click may close the menu. Some mobile browsers fire `focus` and then a delayed
   * `click` for one tap, so a focus-open briefly ignores touch clicks.
   */
  allowTouchToClose: boolean;
  readonly allowTouchToCloseTimeout: Timeout;
  /**
   * Returns the open state of the `Menu.Root`, which tells a repeated request apart. Set only
   * while the Root is mounted, so open changes requested while it isn't are dropped.
   */
  getCommittedOpenState: (() => MenuCommittedOpenState) | undefined;
};

/**
 * The open state a `Menu.Root` last committed.
 */
export interface MenuCommittedOpenState {
  open: boolean;
  activeTriggerElement: Element | null;
  openChangeReason: MenuRoot.ChangeEventReason | null;
}

type S = State<unknown>;

const selectors = {
  ...popupStoreSelectors,
  disabled: (state: S) =>
    state.parent.type === 'menubar'
      ? state.parent.context.disabled || state.disabled
      : state.disabled,
  modal: (state: S) =>
    (state.parent.type === undefined || state.parent.type === 'context-menu') &&
    (state.modal ?? true),
  openMethod: (state: S) => state.openMethod,
  keyboardOpen: (state: S) => state.keyboardOpen,

  allowMouseEnter: (state: S) => state.allowMouseEnter,
  highlightItemOnHover: (state: S) => state.highlightItemOnHover,
  parent: (state: S) => state.parent,
  rootId: (state: S): string | undefined => {
    if (state.parent.type === 'menu') {
      return state.parent.store.select('rootId');
    }

    return state.parent.type !== undefined ? state.parent.context.rootId : state.rootId;
  },
  activeIndex: (state: S) => state.activeIndex,
  listElement: (state: S) => state.listElement,
  /** The trigger's `aria-controls`: the list when one holds the `menu` role, else the popup. */
  triggerControlsId: (state: S, triggerId: string | undefined) => {
    const popupId = popupStoreSelectors.triggerPopupId(state, triggerId);
    return popupId ? state.listElement?.id || popupId : undefined;
  },
  filterTriggerProps: (state: S) => state.filterTriggerProps,
  inputProps: (state: S) => state.inputProps,
  // `aria-selected` is invalid on `menuitem`, but Safari VoiceOver needs it for arrow-key
  // navigation. Limit it to WebKit while the input has focus so normal VoiceOver navigation
  // does not encounter the invalid attribute.
  webkitAriaSelected: (state: S, highlighted: boolean) =>
    platform.engine.webkit && state.inputFocused && highlighted ? true : undefined,
  highlightedItemId: (state: S) => state.highlightedItem?.id || undefined,
  isActive: (state: S, itemIndex: number) => state.activeIndex === itemIndex,
  highlightedWhileOpen: (state: S, highlighted: boolean) =>
    highlighted && popupStoreSelectors.open(state),
  hoverEnabled: (state: S) => state.hoverEnabled,
  // `trigger-change` describes a popup moving between triggers, which only has meaning while it
  // is open. Dropping it once closed keeps a late or stale restoration from marking a closing
  // popup instant and skipping its exit transition, including on close paths that never reach
  // `setOpen` — a controlled consumer committing `open={false}` goes straight through the prop.
  instantType: (state: S): MenuInstantType =>
    state.instantType === 'trigger-change' && !popupStoreSelectors.open(state)
      ? undefined
      : state.instantType,
  lastOpenChangeReason: (state: S) => state.openChangeReason,
  floatingTreeRoot: (state: S): FloatingTreeStore => {
    if (state.parent.type === 'menu') {
      return state.parent.store.select('floatingTreeRoot');
    }

    return state.floatingTreeRoot;
  },
  floatingNodeId: (state: S) => state.floatingNodeId,
  floatingParentNodeId: (state: S) => state.floatingParentNodeId,
  itemProps: (state: S) => state.itemProps,
  closeDelay: (state: S) => state.closeDelay,
  adaptiveOrigin: (state: S): AdaptiveOriginMiddleware | undefined => state.adaptiveOrigin,
  keyboardEventRelay: (state: S): ((event: KeyboardEvent) => void) | undefined => {
    if (state.keyboardEventRelay) {
      return state.keyboardEventRelay;
    }

    if (state.parent.type === 'menu') {
      return state.parent.store.select('keyboardEventRelay');
    }

    return undefined;
  },
};

export type MenuStoreSelectors = typeof selectors;

/**
 * The store view that detached handle-backed triggers read from. Both the real `MenuStore` and the
 * inert fallback store satisfy it.
 */
export type MenuHandleStore<Payload> = PopupTriggerDataStore<State<Payload>> &
  Pick<MenuStore<Payload>, 'setOpen' | 'context' | 'select' | 'state'>;

export class MenuStore<Payload> extends BasePopupStore<
  State<Payload>,
  MenuStoreContext,
  MenuStoreSelectors,
  MenuRoot.ChangeEventDetails
> {
  constructor(initialState?: Partial<State<Payload>>, defaultPopupId?: string | undefined) {
    super(createInitialState<Payload>(defaultPopupId, initialState), createInitialContext(), selectors);

    // Share the mouse-up trigger ref of the parent menu, menubar or context menu, if any.
    const ownAllowMouseUpTriggerRef = this.context.allowMouseUpTriggerRef;
    Object.defineProperty(this.context, 'allowMouseUpTriggerRef', {
      configurable: true,
      enumerable: true,
      get: () => {
        const parent = this.state.parent;
        if (parent.type === 'menu') {
          return parent.store.context.allowMouseUpTriggerRef;
        }
        if (parent.type !== undefined) {
          return parent.context.allowMouseUpTriggerRef;
        }
        return ownAllowMouseUpTriggerRef;
      },
    });
  }

  protected override isOpenChangeIgnored(
    nextOpen: boolean,
    eventDetails: MenuRoot.ChangeEventDetails,
  ) {
    const getCommittedOpenState = this.context.getCommittedOpenState;
    if (!getCommittedOpenState) {
      return true;
    }

    // Some mobile browsers fire `focus` and then a delayed `click` for one tap. Without this guard,
    // a menu that opened on focus would close on the click right away.
    const nativeEvent = eventDetails.event as Event | undefined;
    if (
      !nextOpen &&
      eventDetails.reason !== REASONS.itemPress &&
      nativeEvent?.type === 'click' &&
      (nativeEvent as PointerEvent).pointerType === 'touch' &&
      !this.context.allowTouchToClose
    ) {
      return true;
    }

    // Repeated requests are compared against what the Root last committed.
    const committed = getCommittedOpenState();
    return (
      committed.open === nextOpen &&
      eventDetails.trigger === committed.activeTriggerElement &&
      committed.openChangeReason === eventDetails.reason
    );
  }

  protected override getCloseTrigger() {
    return this.context.getCommittedOpenState?.().activeTriggerElement;
  }

  protected override isCommittedSynchronously() {
    return false;
  }

  protected override prepareOpenChange(
    nextOpen: boolean,
    eventDetails: MenuRoot.ChangeEventDetails,
  ) {
    const reason = eventDetails.reason;
    const nativeEvent = eventDetails.event as Event | undefined;

    if (nextOpen && reason === REASONS.triggerFocus) {
      this.context.allowTouchToClose = false;
      this.context.allowTouchToCloseTimeout.start(300, () => {
        this.context.allowTouchToClose = true;
      });
    } else {
      this.context.allowTouchToClose = true;
      this.context.allowTouchToCloseTimeout.clear();
    }

    this.context.lastOpenChangeEvent = eventDetails.event;

    let instantType: MenuInstantType;
    if (
      this.state.parent.type === 'menubar' &&
      (reason === REASONS.triggerFocus ||
        reason === REASONS.focusOut ||
        reason === REASONS.triggerHover ||
        reason === REASONS.listNavigation ||
        reason === REASONS.siblingOpen)
    ) {
      instantType = 'group';
    } else if (isKeyboardClick(reason, nativeEvent)) {
      instantType = 'click';
    } else if (!nextOpen && (reason === REASONS.escapeKey || reason == null)) {
      instantType = 'dismiss';
    }

    return {
      keyboardOpen: nextOpen && isKeyboardOpen(reason, nativeEvent),
      instantType,
    } as Partial<State<Payload>>;
  }

  protected override prepareUnmount() {
    return { allowMouseEnter: false } as Partial<State<Payload>>;
  }

  setActiveIndex(
    activeIndex: number | null,
    reason: MenuRoot.HighlightEventReason,
    event?: Event | undefined,
  ) {
    // Only a write that changes the index is reported. Tagging a no-op, or a write back to the
    // reported item before the change commits, would let a later registry-driven re-emit report
    // this reason instead of `none`.
    if (this.state.activeIndex !== activeIndex) {
      const item =
        activeIndex === null ? undefined : this.context.itemDomElements.current[activeIndex];
      const isWriteBack = item === this.context.reportedItem;
      this.context.highlightReason = isWriteBack ? 'none' : reason;
      this.context.highlightEvent = isWriteBack ? undefined : event;
    }
    this.set('activeIndex', activeIndex);
  }

  highlightItem(
    element: Element | null,
    reason: MenuRoot.HighlightEventReason,
    event?: Event | undefined,
  ) {
    const index = this.context.itemDomElements.current.indexOf(element as HTMLElement);
    if (index > -1) {
      this.setActiveIndex(index, reason, event);
    }
  }
}

/**
 * Creates the inert fallback store used by detached handle-backed triggers while no `Menu.Root` is
 * attached. It keeps a trigger registry in its context so detached triggers can register before
 * migrating to the live root store. `setOpen` is a no-op.
 */
export function createNullMenuStore<Payload>(): MenuHandleStore<Payload> {
  const store = new NullStore<State<Payload>, MenuStoreContext, MenuStoreSelectors>(
    createInitialState<Payload>(),
    createInitialContext(),
    selectors,
  );
  return Object.assign(store, { setOpen: NOOP }) as unknown as MenuHandleStore<Payload>;
}

function createInitialContext(): MenuStoreContext {
  return {
    ...createPopupStoreContext(),
    typingRef: { current: false },
    itemDomElements: { current: [] },
    itemLabels: { current: [] },
    highlightReason: 'none',
    highlightEvent: undefined,
    reportedItem: undefined,
    allowMouseUpTriggerRef: { current: false },
    virtualFocusRef: undefined,
    triggerFocusTargetRef: { current: null },
    beforeTriggerFocusGuardRef: { current: null },
    beforeContentFocusGuardRef: { current: null },
    lastOpenChangeEvent: undefined,
    allowTouchToClose: true,
    allowTouchToCloseTimeout: new Timeout(),
    getCommittedOpenState: undefined,
  };
}

function createInitialState<Payload>(
  defaultPopupId?: string | undefined,
  initialState?: Partial<State<Payload>>,
): State<Payload> {
  return {
    ...createInitialPopupStoreState<Payload>(defaultPopupId),
    disabled: false,
    modal: true,
    openMethod: null,
    keyboardOpen: false,
    allowMouseEnter: false,
    highlightItemOnHover: true,
    parent: {
      type: undefined,
    },
    rootId: undefined,
    activeIndex: null,
    listElement: null,
    filterTriggerProps: EMPTY_OBJECT as HTMLProps,
    inputProps: EMPTY_OBJECT as HTMLProps,
    inputFocused: false,
    highlightedItem: undefined,
    hoverEnabled: true,
    instantType: undefined,
    openChangeReason: null,
    floatingTreeRoot: new FloatingTreeStore(),
    floatingNodeId: undefined,
    floatingParentNodeId: null,
    itemProps: EMPTY_OBJECT as HTMLProps,
    keyboardEventRelay: undefined,
    closeDelay: 0,
    adaptiveOrigin: undefined,
    ...initialState,
  };
}
