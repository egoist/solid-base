import { Show, createEffect, createMemo, createSignal, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { Timeout } from '@egoist/solid-base-utils/timeout';
import { EMPTY_OBJECT } from '@egoist/solid-base-utils/empty';
import { contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { createClick } from '../../utils/popups/interactions/click';
import {
  createFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
} from '../../utils/popups/tree/FloatingTree';
import { createFocus } from '../../utils/popups/interactions/focus';
import { createHoverTriggerInteraction } from '../../utils/popups/interactions/hoverTriggerInteraction';
import { FloatingTreeStore } from '../../utils/popups/tree/FloatingTreeStore';
import { useMenuRootContext } from '../root/MenuRootContext';
import { pressableTriggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../internals/types';
import { createButton } from '../../internals/use-button/createButton';
import { isMouseWithinBounds } from '../../utils/getPseudoElementBounds';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { findRootOwnerId } from '../utils/findRootOwnerId';
import {
  createDynamicPropsSource,
  createStoreProxy,
  createTriggerDataForwarding,
} from '../../utils/popups/popupStoreUtils';
import { createTriggerFocusGuards } from '../../utils/popups/triggerFocusGuards';
import { createBaseUiId } from '../../internals/baseUiId';
import { REASONS } from '../../internals/reasons';
import { createMixedToggleClickHandler } from './mixedToggleClickHandler';
import type { MenuHandle } from '../store/MenuHandle';
import type { MenuHandleStore, State as MenuStoreState } from '../store/MenuStore';
import { useMenubarContext } from '../../menubar/MenubarContext';
import type { MenuParent } from '../root/MenuRoot';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { FocusGuard } from '../../utils/popups/focus/FocusGuard';
import type { PopupInteractionStore } from '../../utils/popups/types';

/**
 * A button that opens the menu.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuTrigger<Payload = unknown>(
  componentProps: MenuTrigger.Props<Payload>,
): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'nativeButton',
    'id',
    'openOnHover',
    'delay',
    'closeDelay',
    'handle',
    'payload',
  );

  const rootContext = useMenuRootContext(true);
  // A trigger without a Root must have a handle (read once to validate the structure).
  const initialHandle = untrack(() => componentProps.handle);
  if (!initialHandle && !rootContext) {
    throw new Error(
      'Base UI: <Menu.Trigger> must be either used within a <Menu.Root> component or provided with a handle.',
    );
  }

  const store = (): MenuHandleStore<Payload> =>
    componentProps.handle?.store ??
    (rootContext!.store as unknown as MenuHandleStore<Payload>);

  const thisTriggerId = createBaseUiId(() => componentProps.id);

  const isTriggerActive = () => store().select('isTriggerActive', thisTriggerId()) as boolean;
  const isOpenedByThisTrigger = () =>
    store().select('isOpenedByTrigger', thisTriggerId()) as boolean;
  const controlsId = () =>
    store().select('triggerControlsId', thisTriggerId()) as string | undefined;
  const lastOpenChangeReason = () => store().select('lastOpenChangeReason');

  const [triggerElement, setTriggerElement] = createSignal<HTMLElement | null>(null);
  let triggerEl: HTMLElement | null = null;
  onCleanup(() => {
    triggerEl = null;
  });

  const menubarContext = useMenubarContext(true);
  const parent: MenuParent = menubarContext
    ? { type: 'menubar', context: menubarContext }
    : { type: undefined };
  const isInMenubar = parent.type === 'menubar';

  const compositeRootContext = useCompositeRootContext(true);
  const floatingTreeRootFromContext = useFloatingTree();
  // Solid-specific: outside a tree (a detached trigger outside a menubar), join the Root's tree
  // instead of creating one. Upstream forwards a new tree and re-renders the whole menu family into
  // it, but here trees are read once: submenus mounted before the forwarding effect runs would
  // otherwise stay in the Root's tree while their children join the trigger's.
  const floatingTreeRoot =
    floatingTreeRootFromContext ??
    (untrack(() => store().state.floatingTreeRoot) as FloatingTreeStore | undefined) ??
    new FloatingTreeStore();

  // A trigger rendered inside its Root shares the Root's position in the floating tree. A detached
  // trigger (rendered outside the Root, for example in a menubar) supplies its own.
  const detachedFromRoot = !rootContext;
  const floatingNodeId = detachedFromRoot ? createFloatingNodeId(floatingTreeRoot) : undefined;
  const floatingParentNodeId = useFloatingParentNodeId();

  const closeDelay = () => componentProps.closeDelay ?? 0;
  const delay = () => componentProps.delay ?? 100;

  const { registerTrigger, isMountedByThisTrigger } = createTriggerDataForwarding<
    MenuStoreState<Payload>
  >(thisTriggerId, store, () => {
    const isDetached = detachedFromRoot || store() !== (rootContext?.store as unknown);
    const updates: Partial<MenuStoreState<Payload>> = {
      payload: componentProps.payload,
      closeDelay: closeDelay(),
    };
    if (isDetached) {
      updates.parent = parent;
      updates.floatingTreeRoot = floatingTreeRoot;
      if (floatingNodeId !== undefined) {
        updates.floatingNodeId = floatingNodeId;
        updates.floatingParentNodeId = floatingParentNodeId;
      }
      updates.keyboardEventRelay = compositeRootContext?.relayKeyboardEvent;
    }
    return updates;
  });

  const rootDisabled = () => store().select('disabled') as boolean;
  const disabled = () =>
    (componentProps.disabled ?? false) ||
    rootDisabled() ||
    (parent.type === 'menubar' && parent.context.disabled);

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => componentProps.nativeButton ?? true,
  });

  createEffect(isOpenedByThisTrigger, (openedByThisTrigger) => {
    if (!openedByThisTrigger && parent.type === undefined) {
      untrack(store).context.allowMouseUpTriggerRef.current = false;
    }
  });

  const allowMouseUpTriggerTimeout = new Timeout();
  onCleanup(allowMouseUpTriggerTimeout.clear);

  function handleDocumentMouseUp(mouseEvent: MouseEvent) {
    if (!triggerEl) {
      return;
    }

    const currentStore = untrack(store);

    allowMouseUpTriggerTimeout.clear();
    currentStore.context.allowMouseUpTriggerRef.current = false;

    const mouseUpTarget = getTarget(mouseEvent) as Element | null;

    if (
      contains(triggerEl, mouseUpTarget) ||
      contains(currentStore.select('positionerElement'), mouseUpTarget) ||
      mouseUpTarget === triggerEl
    ) {
      return;
    }

    if (
      mouseUpTarget != null &&
      findRootOwnerId(mouseUpTarget) === currentStore.select('rootId')
    ) {
      return;
    }

    if (isMouseWithinBounds(mouseEvent, triggerEl)) {
      return;
    }

    (currentStore.select('floatingTreeRoot') as FloatingTreeStore).events.emit('close', {
      domEvent: mouseEvent,
      reason: REASONS.cancelOpen,
    });
  }

  createEffect(
    () => isOpenedByThisTrigger() && lastOpenChangeReason() === REASONS.triggerHover,
    (openedByHover) => {
      if (!openedByHover) {
        return undefined;
      }
      const doc = ownerDocument(triggerEl);
      doc.addEventListener('mouseup', handleDocumentMouseUp, { once: true });
      return () => {
        doc.removeEventListener('mouseup', handleDocumentMouseUp);
      };
    },
  );

  const parentMenubarHasSubmenuOpen = () =>
    parent.type === 'menubar' && parent.context.hasSubmenuOpen;
  const openOnHover = () => componentProps.openOnHover ?? parentMenubarHasSubmenuOpen();

  const interactionStore = createStoreProxy(
    store as unknown as () => MenuHandleStore<Payload> & PopupInteractionStore,
  );

  const hoverProps = createHoverTriggerInteraction(interactionStore, {
    get enabled() {
      return (
        openOnHover() &&
        !disabled() &&
        (!isInMenubar || (parentMenubarHasSubmenuOpen() && !isMountedByThisTrigger()))
      );
    },
    handleClose: safePolygon({ blockPointerEvents: !isInMenubar }),
    mouseOnly: true,
    move: false,
    restMs: parent.type === undefined ? () => delay() : undefined,
    delay: () => ({ close: closeDelay() }),
    get triggerElement() {
      return triggerElement();
    },
    externalTree: floatingTreeRoot,
    get isActiveTrigger() {
      return isTriggerActive();
    },
  });

  // Whether to ignore clicks to open the menu: only "patient" clicks close a menu opened on hover.
  const [stickIfOpen, setStickIfOpen] = createSignal(false);
  const stickIfOpenTimeout = new Timeout();
  onCleanup(stickIfOpenTimeout.clear);
  createEffect(
    () => [isOpenedByThisTrigger(), lastOpenChangeReason()] as const,
    ([openedByThisTrigger, reason]) => {
      if (openedByThisTrigger && reason === REASONS.triggerHover) {
        // If they clicked within 500ms of the menu opening, keep it open.
        setStickIfOpen(true);
        stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
          setStickIfOpen(false);
        });
      } else if (!openedByThisTrigger) {
        stickIfOpenTimeout.clear();
        setStickIfOpen(false);
      }
    },
  );

  const click = createClick(interactionStore, {
    get enabled() {
      return !disabled();
    },
    get event() {
      return isOpenedByThisTrigger() && isInMenubar ? 'click' : 'mousedown';
    },
    toggle: true,
    ignoreMouse: false,
    stickIfOpen: () => (parent.type === undefined ? untrack(stickIfOpen) : false),
  });

  const focus = createFocus(interactionStore, {
    get enabled() {
      return !disabled() && parentMenubarHasSubmenuOpen();
    },
  });

  const mixedToggleHandlers = createMixedToggleClickHandler({
    get open() {
      return isOpenedByThisTrigger();
    },
    enabled: isInMenubar,
    mouseDownAction: 'open',
  });

  const rootTriggerProps = createDynamicPropsSource(
    () => store().select('triggerProps', isMountedByThisTrigger()) as HTMLProps,
  );
  // A filterable menu keeps real focus inside its popup and publishes what its trigger needs.
  const filterTriggerProps = createDynamicPropsSource(
    () => store().select('filterTriggerProps') as HTMLProps,
  );

  const { handlePreFocusGuardFocus, handleFocusTargetFocus } = createTriggerFocusGuards(
    {
      setOpen: (open, details) => untrack(store).setOpen(open, details as any),
      select: (key) => store().select(key),
      get context() {
        return untrack(store).context;
      },
    },
    triggerElement,
  );

  const state: MenuTrigger.State = {
    get disabled() {
      return disabled();
    },
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  const ref = [
    (element: HTMLElement) => {
      triggerEl = element;
      setTriggerElement(element);
    },
    buttonRef,
    registerTrigger,
  ];

  const props = [
    focus.reference,
    click.reference,
    hoverProps,
    rootTriggerProps,
    {
      'aria-haspopup': 'menu' as const,
      get 'aria-controls'() {
        return controlsId();
      },
      get id() {
        return thisTriggerId();
      },
      onMouseDown(event: MouseEvent) {
        const currentStore = untrack(store);
        if (currentStore.select('open')) {
          return;
        }

        // mousedown -> mouseup on menu item should not trigger it within 200ms.
        allowMouseUpTriggerTimeout.start(200, () => {
          currentStore.context.allowMouseUpTriggerRef.current = true;
        });

        const doc = ownerDocument(event.currentTarget as Element);
        doc.addEventListener('mouseup', handleDocumentMouseUp, { once: true });
      },
    },
    filterTriggerProps,
    isInMenubar ? { role: 'menuitem' } : EMPTY_OBJECT,
    mixedToggleHandlers,
    elementProps,
    getButtonProps,
  ];

  if (isInMenubar) {
    return (
      <CompositeItem
        tag="button"
        render={componentProps.render}
        class={componentProps.class}
        style={componentProps.style}
        state={state}
        ref={ref}
        props={props}
        stateAttributesMapping={pressableTriggerOpenStateMapping}
      />
    );
  }

  const element = renderElement('button', componentProps, {
    state,
    ref,
    props,
    stateAttributesMapping: pressableTriggerOpenStateMapping,
  });

  // Solid reconciles the trigger's siblings as one list: inserting nodes both before and after
  // the trigger in the same pass replaces (moves) the trigger element, which drops its focus. The
  // guard before the trigger is therefore added in a later pass, once the one after it is in place.
  const guardsVisible = createMemo(isOpenedByThisTrigger);
  const [beforeGuardReady, setBeforeGuardReady] = createSignal(false);
  createEffect(guardsVisible, (visible) => {
    setBeforeGuardReady(visible);
  });

  return (
    <>
      <Show when={guardsVisible() && beforeGuardReady()}>
        <TriggerFocusGuard
          target={untrack(store).context.beforeTriggerFocusGuardRef}
          onFocus={handlePreFocusGuardFocus}
        />
      </Show>
      {element}
      <Show when={guardsVisible()}>
        <TriggerFocusGuard
          target={untrack(store).context.triggerFocusTargetRef}
          onFocus={handleFocusTargetFocus}
        />
      </Show>
    </>
  );
}

/**
 * A focus guard rendered next to the trigger of an open menu, published in a store ref while
 * mounted.
 */
function TriggerFocusGuard(props: {
  target: RefObject<HTMLElement | null>;
  onFocus: (event: FocusEvent) => void;
}) {
  let element: HTMLSpanElement | undefined;
  onCleanup(() => {
    if (props.target.current === element) {
      props.target.current = null;
    }
  });
  return (
    <FocusGuard
      ref={(el: HTMLSpanElement) => {
        element = el;
        props.target.current = el;
      }}
      onFocus={(event: FocusEvent) => props.onFocus(event)}
    />
  );
}

export interface MenuTriggerProps<Payload = unknown>
  extends NativeButtonProps, Omit<BaseUIComponentProps<'button', MenuTriggerState>, 'disabled' | 'id'> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the trigger with a menu.
   */
  handle?: MenuHandle<Payload> | undefined;
  /**
   * A payload to pass to the menu when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element, it is also used to
   * specify the active trigger for the menu in controlled mode (with the MenuRoot `triggerId` prop).
   */
  id?: string | undefined;
  /**
   * How long to wait before the menu may be opened on hover. Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 100
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the menu that was opened on hover.
   * Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * Whether the menu should also open when the trigger is hovered.
   */
  openOnHover?: boolean | undefined;
}

export interface MenuTriggerState {
  /**
   * Whether the menu is currently open and was opened by this trigger.
   */
  open: boolean;
  /**
   * Whether the trigger is disabled.
   */
  disabled: boolean;
}

export namespace MenuTrigger {
  export type Props<Payload = unknown> = MenuTriggerProps<Payload>;
  export type State = MenuTriggerState;
}
