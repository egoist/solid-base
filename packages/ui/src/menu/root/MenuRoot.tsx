import {
  createEffect,
  createMemo,
  createSignal,
  omit,
  onCleanup,
  untrack,
  useContext,
} from 'solid-js';
import { isDev, type JSX } from '@solidjs/web';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { EMPTY_ARRAY, EMPTY_OBJECT, NOOP } from '@egoist/solid-base-utils/empty';
import { Timeout } from '@egoist/solid-base-utils/timeout';
import {
  FloatingTree,
  createFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingParentNodeIdAccessor,
  useFloatingTree,
} from '../../utils/popups/tree/FloatingTree';
import { FloatingTreeStore } from '../../utils/popups/tree/FloatingTreeStore';
import { createDismiss } from '../../utils/popups/interactions/dismiss';
import { createListNavigation } from '../../utils/popups/interactions/listNavigation';
import { createTypeahead } from '../../utils/popups/interactions/typeahead';
import { createOpenInteractionType } from '../../utils/popups/interactions/openInteractionType';
import { MenuRootContext, useMenuRootContext } from './MenuRootContext';
import type { MenubarContext } from '../../menubar/MenubarContext';
import { useMenubarContext } from '../../menubar/MenubarContext';
import { TYPEAHEAD_RESET_MS } from '../../internals/constants';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { createGenericEventDetails } from '../../internals/createBaseUIEventDetails';
import type {
  BaseUIChangeEventDetails,
  BaseUIHighlightEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { getHighlightReason } from '../../utils/getHighlightReason';
import type { ContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import { useContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import { mergeProps } from '../../merge-props/mergeProps';
import {
  canWaitForAnimations,
  createAnimationsFinished,
} from '../../internals/animationsFinished';
import {
  MenuStore,
  deriveActiveMenuTriggerState,
  type MenuInstantType,
} from '../store/MenuStore';
import type { MenuHandle } from '../store/MenuHandle';
import type { ActionsRef, PayloadChildRenderFunction } from '../../utils/popups/popupRoot';
import {
  attachPopupHandle,
  createPopupRootWithPopupId,
  renderPopupRootChildren,
} from '../../utils/popups/popupRoot';
import {
  FOCUSABLE_POPUP_PROPS,
  createPopupInteractionProps,
} from '../../utils/popups/popupStoreUtils';
import { createBaseUiId } from '../../internals/baseUiId';
import type { HTMLProps } from '../../internals/types';
import { MenuFilterProviderContext } from '../filter-provider/MenuFilterProviderContext';

/**
 * The implementation of `Menu.Root` and `Menu.SubmenuRoot`.
 * @internal
 */
export function MenuRootInternal<Payload>(props: MenuRootInternalProps<Payload>): JSX.Element {
  const contextMenuContext = useContextMenuRootContext(true);
  const parentMenuRootContext = useMenuRootContext(true);
  const menubarContext = useMenubarContext(true);
  const contextTree = useFloatingTree();

  // Structural props: fixed for the lifetime of the Root.
  const isSubmenu = untrack(() => props.isSubmenu) ?? false;
  const virtualFocus = untrack(() => props.virtualFocus) ?? false;
  const virtualFocusRef = untrack(() => props.virtualFocusRef);

  const enclosingMenuStore = parentMenuRootContext?.store;
  const parentVirtualFocus = parentMenuRootContext?.virtualFocus ?? false;

  let parentFromContext: MenuParent;
  if (isSubmenu && enclosingMenuStore) {
    parentFromContext = { type: 'menu', store: enclosingMenuStore };
  } else if (menubarContext) {
    parentFromContext = { type: 'menubar', context: menubarContext };
  } else if (contextMenuContext && !enclosingMenuStore) {
    // Ensure this is not a Menu nested inside ContextMenu.Trigger: ContextMenu.Root provides a
    // `null` MenuRootContext to its Menu.Root.
    parentFromContext = { type: 'context-menu', context: contextMenuContext };
  } else {
    parentFromContext = { type: undefined };
  }

  const rootId = createBaseUiId()();
  const generatedPopupId = createBaseUiId()();

  const floatingParentNodeIdFromContext = useFloatingParentNodeId();
  const floatingParentNodeIdAccessor = useFloatingParentNodeIdAccessor();

  const parentMenuStore = parentFromContext.type === 'menu' ? parentFromContext.store : undefined;

  // The tree the menu family shares: the parent menu's, the menubar's, or a new one.
  let initialFloatingTreeRoot: FloatingTreeStore;
  if (parentMenuStore) {
    initialFloatingTreeRoot = untrack(() => parentMenuStore.select('floatingTreeRoot'));
  } else if (parentFromContext.type === 'menubar' && contextTree) {
    initialFloatingTreeRoot = contextTree;
  } else {
    initialFloatingTreeRoot = new FloatingTreeStore();
  }

  // A submenu's node follows its parent menu's tree, which moves to a detached trigger's tree
  // while that trigger is active (upstream re-registers it when `floatingTreeRoot` changes).
  const floatingNodeIdFromContext = createFloatingNodeId(
    parentMenuStore
      ? () => parentMenuStore.select('floatingTreeRoot') as FloatingTreeStore
      : initialFloatingTreeRoot,
  );

  // An initially open submenu should animate in only when the user watches it appear, i.e. when
  // its subtree mounts because the parent popup is playing its own enter transition. Read once.
  // The parent's transition status is read through a memo: it is a derived signal that changes in
  // the same flush that mounts this subtree, and an untracked read would return its last
  // committed value (`undefined`) instead of `'starting'`.
  const parentStarting = parentMenuStore
    ? createMemo(() => parentMenuStore.select('transitionStatus') === 'starting')
    : undefined;
  const animateInitialOpen = untrack(
    () => ((props.open ?? props.defaultOpen ?? false) && parentStarting?.()) || false,
  );

  // Mirror an instantly-opened parent (e.g. keyboard click) so `[data-instant]` styling
  // suppresses the enter transition on both popups or neither.
  const seededInstantType: MenuInstantType = animateInitialOpen
    ? parentMenuStore?.select('instantType')
    : undefined;

  const { store, open, transitionStatus } = createPopupRootWithPopupId(
    props,
    (initialState, initialPopupId) => {
      const menuStore = new MenuStore<Payload>(
        {
          ...initialState,
          parent: parentFromContext,
          disabled: untrack(() => props.disabled) ?? false,
          highlightItemOnHover: untrack(() => props.highlightItemOnHover) ?? true,
          modal: parentFromContext.type === undefined ? untrack(() => props.modal) : undefined,
          rootId,
          seededInstantType,
          floatingTreeRoot: initialFloatingTreeRoot,
          floatingNodeId: floatingNodeIdFromContext,
          floatingParentNodeId: floatingParentNodeIdFromContext,
        },
        initialPopupId,
      );
      menuStore.context.virtualFocusRef = virtualFocusRef;
      return menuStore;
    },
    generatedPopupId,
    { animateInitialOpen },
  );

  if (menubarContext) {
    onCleanup(menubarContext.registerMenu(() => store));
  }

  const parent = () => store.select('parent');
  const disabled = () => store.select('disabled');
  const activeIndex = () => store.select('activeIndex');

  if (isDev) {
    createEffect(
      () => parent().type !== undefined && props.modal !== undefined,
      (unsupported) => {
        if (unsupported) {
          console.warn(
            'Base UI: The `modal` prop is not supported on nested menus. It will be ignored.',
          );
        }
      },
    );
  }

  const { openMethod, triggerProps: interactionTypeProps } = createOpenInteractionType(open);

  store.bind('disabled', () => props.disabled ?? false);
  store.bind('highlightItemOnHover', () => props.highlightItemOnHover ?? true);
  store.bind('modal', () => (parent().type === undefined ? props.modal : undefined));
  store.bind('openMethod', openMethod);
  store.bind('rootId', () => rootId);

  attachPopupHandle(() => props.handle, store);

  // An inherited `instantType` is only for the initial reveal: it ends once the enter phase
  // settles, when the menu closes (a controlled `open` flip bypasses `setOpen`), or with the next
  // open change, which writes its own (see `MenuStore.prepareOpenChange`).
  if (seededInstantType !== undefined) {
    const popupElement = () => store.select('popupElement');
    const [revealAnimationsFinished, setRevealAnimationsFinished] = createSignal(false, {
      name: 'MenuRoot.revealAnimationsFinished',
    });
    const seedEnded = createMemo<boolean>(
      (ended) => {
        if (ended || !open()) {
          return true;
        }
        if (transitionStatus() !== undefined) {
          return false;
        }
        const element = popupElement();
        return element == null || !canWaitForAnimations(element) || revealAnimationsFinished();
      },
      { name: 'MenuRoot.seededInstantTypeEnded' },
    );
    onCleanup(
      store.derive('seededInstantType', (stored) => (seedEnded() ? undefined : stored)),
    );

    const runOnceAnimationsFinish = createAnimationsFinished(popupElement);
    createEffect(
      () => !seedEnded() && transitionStatus() === undefined,
      (waitForReveal) => {
        if (!waitForReveal) {
          return undefined;
        }
        const abortController = new AbortController();
        runOnceAnimationsFinish(() => setRevealAnimationsFinished(true), abortController.signal);
        return () => abortController.abort();
      },
    );
  }

  // A submenu follows its parent menu's node, which moves to a detached trigger's node while that
  // trigger is active.
  if (parentMenuRootContext) {
    createEffect(floatingParentNodeIdAccessor, (floatingParentNodeId) => {
      store.update({ floatingNodeId: floatingNodeIdFromContext, floatingParentNodeId });
    });
  }

  // A trigger supplies its payload and close delay while it is active, and a detached trigger
  // the menu's place in the tree.
  deriveActiveMenuTriggerState(store);

  let allowOutsidePressDismissal = parentFromContext.type !== 'context-menu';
  const allowOutsidePressDismissalTimeout = new Timeout();
  onCleanup(allowOutsidePressDismissalTimeout.clear);

  createEffect(
    () => [open(), parent().type] as const,
    ([isOpen, parentType]) => {
      if (!isOpen) {
        store.context.lastOpenChangeEvent = undefined;
      }

      if (parentType !== 'context-menu') {
        return;
      }

      if (!isOpen) {
        allowOutsidePressDismissalTimeout.clear();
        allowOutsidePressDismissal = false;
        return;
      }

      // With `mousedown` outside press events and long press touch input, there
      // needs to be a grace period after opening to ensure the dismissal event
      // doesn't fire immediately after open.
      allowOutsidePressDismissalTimeout.start(500, () => {
        allowOutsidePressDismissal = true;
      });
    },
  );

  onCleanup(() => store.context.allowTouchToCloseTimeout.clear());

  // Hovering over a submenu trigger opens its submenu until the pointer interacts with this menu's
  // popup. It's a writable memo that every open change resets, and a closed menu always has it.
  const [hoverEnabledWhileOpen, setHoverEnabledWhileOpen] = createSignal(
    () => {
      open();
      return true;
    },
    { name: 'hoverEnabled' },
  );
  store.bind('hoverEnabled', () => !open() || hoverEnabledWhileOpen());
  store.context.disableHover = () => setHoverEnabledWhileOpen(false);
  onCleanup(() => {
    store.context.disableHover = NOOP;
  });

  // Repeated open requests are compared against the Root's current open state. Open changes are
  // run only while this Root is mounted.
  store.context.getCommittedOpenState = () => ({
    open: store.select('open'),
    activeTriggerElement: store.select('activeTriggerElement'),
    openChangeReason: store.select('lastOpenChangeReason'),
  });
  onCleanup(() => {
    store.context.getCommittedOpenState = undefined;
  });

  if (parentFromContext.type === 'context-menu') {
    const ctx: ContextMenuRootContext = parentFromContext.context;
    ctx.actionsRef.current = { setOpen: store.setOpen };
    createEffect(
      () => store.select('positionerElement'),
      (positionerElement) => {
        ctx.positionerRef.current = positionerElement;
      },
    );
    onCleanup(() => {
      ctx.actionsRef.current = null;
      ctx.positionerRef.current = null;
    });
  }

  const nested = floatingParentNodeIdFromContext != null;

  const dismiss = createDismiss(store, {
    get enabled() {
      return !disabled();
    },
    get bubbles() {
      return { escapeKey: (props.closeParentOnEsc ?? false) && parent().type === 'menu' };
    },
    outsidePress() {
      if (
        store.state.parent.type !== 'context-menu' ||
        store.context.lastOpenChangeEvent?.type === 'contextmenu'
      ) {
        return true;
      }

      return allowOutsidePressDismissal;
    },
    externalTree: nested ? initialFloatingTreeRoot : undefined,
  });

  const direction = useDirection();
  const orientation = () => props.orientation ?? 'vertical';
  const loopFocus = () => props.loopFocus ?? true;
  const allowEscapeProp = () => props.allowEscape ?? true;
  const highlightItemOnHover = () => props.highlightItemOnHover ?? true;

  const listNavigation = createListNavigation(store, {
    get enabled() {
      return !disabled();
    },
    listRef: store.context.itemDomElements,
    get activeIndex() {
      return activeIndex();
    },
    virtual: virtualFocus,
    get nested() {
      const parentType = parent().type;
      return parentType === 'menubar' || (!virtualFocus && parentType !== undefined);
    },
    get parentOrientation() {
      const currentParent = parent();
      return currentParent.type === 'menubar' ? currentParent.context.orientation : undefined;
    },
    get loopFocus() {
      return loopFocus();
    },
    // Filtered menus keep DOM focus on the input, while keyboard and virtual opens initially
    // highlight an item as ordinary menus do.
    get focusItemOnOpen() {
      return virtualFocus ? store.select('keyboardOpen') : undefined;
    },
    get allowEscape() {
      return virtualFocus && loopFocus() && allowEscapeProp();
    },
    get orientation() {
      return orientation();
    },
    // A virtual-focus list can navigate on either axis, but its trigger always opens on the
    // vertical one.
    get triggerOrientation() {
      return virtualFocus ? 'vertical' : orientation();
    },
    get rtl() {
      return direction() === 'rtl';
    },
    disabledIndices: EMPTY_ARRAY as number[],
    onNavigate(nextActiveIndex, event) {
      store.setActiveIndex(nextActiveIndex, getHighlightReason(event), event);
    },
    // A virtual-focus submenu's keyboard opening is orchestrated by its navigation wrapper.
    get openOnArrowKeyDown() {
      return parent().type !== 'context-menu' && !(virtualFocus && isSubmenu);
    },
    // A root context menu's focus manager is modal, so its guard swallows Tab when no item is
    // tabbable. Close it here instead, as a regular menu closes when Tab moves focus out.
    get closeOnTab() {
      return parent().type === 'context-menu';
    },
    externalTree: !virtualFocus && nested ? initialFloatingTreeRoot : undefined,
    nestedReturnFocusRef: parentMenuStore?.context.virtualFocusRef,
    get focusItemOnHover() {
      return highlightItemOnHover();
    },
    get resetOnPointerLeave() {
      return props.resetOnPointerLeave ?? true;
    },
  });

  const typeahead = createTypeahead(store, {
    // Under virtual focus the input owns typing, so typeahead would race the filter query.
    get enabled() {
      return !disabled() && !virtualFocus;
    },
    listRef: store.context.itemLabels,
    elementsRef: store.context.itemDomElements,
    get activeIndex() {
      return activeIndex();
    },
    resetMs: TYPEAHEAD_RESET_MS,
    onMatch: (index, event) => {
      if (store.select('open') && index !== store.state.activeIndex) {
        store.setActiveIndex(index, REASONS.keyboard, event);
      }
    },
    onTyping(nextTyping) {
      store.context.typingRef.current = nextTyping;
    },
  });

  let lastHighlightIndex = -1;

  // Runs when `activeIndex` commits and again when the item registry settles, since an index
  // can come to point at a different element while its value stays the same.
  function syncHighlightedItem() {
    const index = store.state.activeIndex;
    const item =
      index === null ? undefined : (store.context.itemDomElements.current[index] ?? undefined);
    // An item removed in this commit stays registered until the list flushes, which calls back
    // here with the settled registry.
    if (item?.isConnected === false) {
      return;
    }

    const itemIndex = item === undefined ? -1 : index!;
    if (lastHighlightIndex === itemIndex && store.context.reportedItem === item) {
      return;
    }

    lastHighlightIndex = itemIndex;
    store.context.reportedItem = item;
    // Only virtual focus renders from the highlighted element.
    if (virtualFocus) {
      store.set('highlightedItem', item);
    }
    const { highlightReason, highlightEvent } = store.context;
    store.context.highlightReason = REASONS.none;
    store.context.highlightEvent = undefined;
    const onItemHighlighted = untrack(() => props.onItemHighlighted);
    if (!onItemHighlighted) {
      return;
    }
    onItemHighlighted(
      item,
      createGenericEventDetails(highlightReason, highlightEvent, {
        label:
          item === undefined
            ? undefined
            : (store.context.itemLabels.current[itemIndex] ?? undefined),
      }),
    );
  }

  createEffect(activeIndex, () => {
    syncHighlightedItem();
  });

  // Under virtual focus an element inside the popup holds real focus, so it takes the
  // navigation's reference props (`aria-activedescendant` and the key handling) and the trigger
  // keeps only the props that open the menu. Focusing the trigger while the menu is open must not
  // seed the virtual highlight.
  const openTriggerProps: HTMLProps = !virtualFocus
    ? listNavigation.reference!
    : listNavigation.trigger
      ? (omit(listNavigation.trigger as Record<string, any>, 'onFocus') as HTMLProps)
      : (EMPTY_OBJECT as HTMLProps);

  store.set(
    'inputProps',
    virtualFocus ? (listNavigation.reference ?? (EMPTY_OBJECT as HTMLProps)) : (EMPTY_OBJECT as HTMLProps),
  );

  const activeTriggerProps = mergeProps(
    typeahead.reference,
    openTriggerProps,
    dismiss.reference,
    {
      onMouseMove() {
        store.set('allowMouseEnter', true);
      },
    },
    interactionTypeProps,
    {
      'aria-haspopup': 'menu',
      get 'aria-expanded'() {
        return open();
      },
    },
  ) as HTMLProps;

  const inactiveTriggerProps = mergeProps(
    listNavigation.trigger,
    dismiss.trigger,
    interactionTypeProps,
    {
      'aria-haspopup': 'menu',
      'aria-expanded': false,
    },
  ) as HTMLProps;

  const popupProps = mergeProps(
    FOCUSABLE_POPUP_PROPS,
    {
      onMouseMove() {
        store.set('allowMouseEnter', true);
        if (store.state.parent.type === 'menu') {
          store.context.disableHover();
        }
      },
      onClick() {
        store.context.disableHover();
      },
      onKeyDown(event: KeyboardEvent) {
        // The Menubar's CompositeRoot captures keyboard events via event delegation. This works
        // when Menu.Root is nested inside Menubar, but with detached triggers the event must be
        // forwarded to the CompositeRoot manually.
        const relay = store.select('keyboardEventRelay');
        if (relay && !event.cancelBubble) {
          relay(event);
        }
      },
    },
    typeahead.floating,
    listNavigation.floating,
    dismiss.floating,
  ) as HTMLProps;

  createPopupInteractionProps(store, {
    activeTriggerProps,
    inactiveTriggerProps,
    popupProps,
  });
  store.set('itemProps', (listNavigation.item as HTMLProps | undefined) ?? (EMPTY_OBJECT as HTMLProps));
  onCleanup(() => store.set('itemProps', EMPTY_OBJECT as HTMLProps));

  const context: MenuRootContext<Payload> = {
    store,
    parent: parentFromContext,
    get orientation() {
      return orientation();
    },
    get loopFocus() {
      return loopFocus();
    },
    get allowEscape() {
      return allowEscapeProp();
    },
    generatedPopupId: () => generatedPopupId,
    setRenderedPopupId(id) {
      store.set('defaultPopupId', (id ?? generatedPopupId) || undefined);
    },
    virtualFocus,
    parentVirtualFocus,
    syncHighlightedItem,
  };

  const content = () => (
    <MenuRootContext value={context as MenuRootContext}>
      {renderPopupRootChildren<Payload>(
        props.children,
        () => store.select('payload') as Payload | undefined,
      )}
    </MenuRootContext>
  );

  if (parentFromContext.type === undefined || parentFromContext.type === 'context-menu') {
    // Set up a FloatingTree to provide the context to nested menus.
    return <FloatingTree externalTree={initialFloatingTreeRoot}>{content()}</FloatingTree>;
  }

  return content();
}

/**
 * Groups all parts of the menu.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Solid Base Menu](https://base.egoist.dev/components/menu)
 */
export function MenuRoot<Payload = unknown>(props: MenuRoot.Props<Payload>): JSX.Element {
  const filterProvider = useContext(MenuFilterProviderContext);

  if (filterProvider === null) {
    return <MenuRootInternal<Payload> {...props} />;
  }

  const FilterRoot = filterProvider.Root;

  return (
    // The root consumes its provider so a plain submenu inside doesn't inherit it.
    <MenuFilterProviderContext value={null}>
      <FilterRoot {...filterProvider.options} {...props} />
    </MenuFilterProviderContext>
  );
}

export interface MenuRootState {}

export interface MenuRootInternalProps<Payload> extends MenuRoot.Props<Payload> {
  /**
   * Marks this root as a submenu of the enclosing menu. Read once.
   */
  isSubmenu?: boolean | undefined;
  /**
   * Keeps real focus on an element inside the popup and navigates the list with
   * `aria-activedescendant`. Read once.
   */
  virtualFocus?: boolean | undefined;
  /**
   * The element that retains real focus while virtual list navigation is active. Read once.
   */
  virtualFocusRef?: RefObject<HTMLElement | null> | undefined;
  /**
   * Whether virtual focus can leave the list during arrow navigation.
   */
  allowEscape?: boolean | undefined;
  /**
   * Whether pointer leave should clear the active item.
   */
  resetOnPointerLeave?: boolean | undefined;
}

export interface MenuRootProps<Payload = unknown> {
  /**
   * Whether the menu is initially open.
   *
   * To render a controlled menu, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Determines if the menu enters a modal state when open.
   * - `true`: user interaction is limited to the menu: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   *
   * Nested menus ignore this prop, and menus opened by hover are never modal.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Event handler called when the menu is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: MenuRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the menu is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Callback fired when an item is highlighted or unhighlighted.
   * Receives the highlighted item element (or `undefined` if no item is highlighted) and details
   * containing the reason for the change, the event, and the item's text label.
   * The `reason` can be:
   * - `'keyboard'`: the highlight changed due to keyboard navigation.
   * - `'pointer'`: the highlight changed due to pointer hovering. The event may be a `MouseEvent`
   *   rather than a `PointerEvent`.
   * - `'none'`: the highlight changed for another reason, such as automatic highlighting while
   *   filtering, the item list changing, or the popup opening or closing.
   */
  onItemHighlighted?:
    | ((
        highlightedItem: HTMLElement | undefined,
        eventDetails: MenuRoot.HighlightEventDetails,
      ) => void)
    | undefined;
  /**
   * Whether the menu is currently open.
   */
  open?: boolean | undefined;
  /**
   * The visual orientation of the menu.
   * Controls whether roving focus uses up/down or left/right arrow keys.
   * @default 'vertical'
   */
  orientation?: MenuRoot.Orientation | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * When in a submenu, determines whether pressing the Escape key
   * closes the entire menu, or only the current child menu.
   * @default false
   */
  closeParentOnEsc?: boolean | undefined;
  /**
   * A ref to imperative actions: a ref object (`{ current: null }`) or a callback receiving them.
   * - `unmount`: Ends the closing phase of the menu after an externally controlled closing animation finishes.
   *   Call `preventUnmountOnClose()` in `onOpenChange` first, otherwise the menu completes closing on its own.
   *   Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the menu imperatively when called.
   */
  actionsRef?: ActionsRef<MenuRoot.Actions> | undefined;
  /**
   * ID of the trigger that the menu is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled menu.
   * There's no need to specify this prop when the menu is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the menu is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open menu.
   */
  defaultTriggerId?: string | null | undefined;
  /**
   * A handle to associate the menu with a trigger.
   * If specified, allows external triggers to control the menu's open state.
   */
  handle?: MenuHandle<Payload> | undefined;
  /**
   * The content of the menu.
   * This can be regular elements or a function that receives the `payload` of the active trigger
   * (called once; `payload` is a live getter).
   */
  children?: JSX.Element | PayloadChildRenderFunction<Payload>;
}

export interface MenuRootActions {
  unmount: () => void;
  close: () => void;
}

export type MenuRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.focusOut
  | typeof REASONS.listNavigation
  | typeof REASONS.escapeKey
  | typeof REASONS.itemPress
  | typeof REASONS.closePress
  | typeof REASONS.siblingOpen
  | typeof REASONS.cancelOpen
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type MenuRootChangeEventDetails = BaseUIChangeEventDetails<MenuRoot.ChangeEventReason> & {
  /** Prevents the popup from unmounting until the `unmount` action is called. */
  preventUnmountOnClose: () => void;
};

export type MenuRootHighlightEventReason =
  | typeof REASONS.keyboard
  | typeof REASONS.pointer
  | typeof REASONS.none;

export type MenuRootHighlightEventDetails = BaseUIHighlightEventDetails<
  MenuRoot.HighlightEventReason,
  {
    /**
     * The highlighted item's `label` prop, or its text content when the prop is not set.
     */
    label: string | undefined;
  }
>;

export type MenuRootOrientation = 'horizontal' | 'vertical';

export type MenuParent =
  | {
      type: 'menu';
      store: MenuStore<unknown>;
    }
  | {
      type: 'menubar';
      context: MenubarContext;
    }
  | {
      type: 'context-menu';
      context: ContextMenuRootContext;
    }
  | {
      type: 'nested-context-menu';
      context: ContextMenuRootContext;
      menuContext: MenuRootContext;
    }
  | {
      type: undefined;
    };

export namespace MenuRoot {
  export type State = MenuRootState;
  export type Props<Payload = unknown> = MenuRootProps<Payload>;
  export type Actions = MenuRootActions;
  export type ChangeEventReason = MenuRootChangeEventReason;
  export type ChangeEventDetails = MenuRootChangeEventDetails;
  export type HighlightEventReason = MenuRootHighlightEventReason;
  export type HighlightEventDetails = MenuRootHighlightEventDetails;
  export type Orientation = MenuRootOrientation;
}
