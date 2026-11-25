import { Show, createEffect, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Timeout } from '@egoist/solid-base-utils/timeout';
import { FloatingNode } from '../../utils/popups/tree/FloatingTree';
import { MenuPositionerContext } from './MenuPositionerContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuRoot } from '../root/MenuRoot';
import type {
  Align,
  CollisionAvoidance,
  CreateAnchorPositioningSharedParameters,
  Side,
} from '../../internals/anchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { CompositeList, createCompositeList } from '../../internals/composite/list/CompositeList';
import { InternalBackdrop } from '../../utils/popups/InternalBackdrop';
import { useMenuPortalContext } from '../portal/MenuPortalContext';
import { DROPDOWN_COLLISION_AVOIDANCE, POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import { useContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { MenuOpenEventDetails } from '../utils/types';
import { createTriggerSwitchTransition } from '../../internals/triggerSwitchTransition';
import { createPopupPositioner } from '../../utils/popups/popupPositioner';
import { createAnchoredPopupScrollLock } from '../../utils/popups/anchoredPopupScrollLock';

/**
 * Positions the menu popup against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuPositioner(componentProps: MenuPositioner.Props): JSX.Element {
  const { store, virtualFocus, syncHighlightedItem } = useMenuRootContext();
  const keepMounted = useMenuPortalContext();
  const contextMenuContext = useContextMenuRootContext(true);

  const parent = () => store.select('parent');
  const floatingTreeRoot = () => store.select('floatingTreeRoot');
  const modal = () => store.select('modal');
  const openMethod = () => store.select('openMethod');
  const triggerElement = () => store.select('activeTriggerElement');
  const positionerElement = () => store.select('positionerElement');
  const lastOpenChangeReason = () => store.select('lastOpenChangeReason');
  const floatingNodeId = () => store.select('floatingNodeId');
  const floatingParentNodeId = () => store.select('floatingParentNodeId');

  const align = () => {
    const currentParent = parent();
    if (currentParent.type === 'context-menu') {
      return componentProps.align ?? 'start';
    }
    if (currentParent.type === 'menu' || currentParent.type === 'menubar') {
      return componentProps.align ?? 'start';
    }
    return componentProps.align;
  };

  const side = () => {
    const currentParent = parent();
    if (currentParent.type === 'menu') {
      return componentProps.side ?? 'inline-end';
    }
    if (currentParent.type === 'menubar') {
      return (
        componentProps.side ??
        (currentParent.context.orientation === 'vertical' ? 'inline-end' : 'bottom')
      );
    }
    return componentProps.side;
  };

  // A context menu's default placement sits next to the cursor.
  const contextMenuOffsets = () => {
    const currentParent = parent();
    return (
      currentParent.type === 'context-menu' &&
      !componentProps.side &&
      (componentProps.align ?? 'start') !== 'center'
    );
  };

  const collisionAvoidance = (): CollisionAvoidance =>
    componentProps.collisionAvoidance ??
    (parent().type === 'menu' ? POPUP_COLLISION_AVOIDANCE : DROPDOWN_COLLISION_AVOIDANCE);

  const isContextMenu = () => parent().type === 'context-menu';

  const initialNodeId = untrack(floatingNodeId);

  const list = createCompositeList({
    elementsRef: store.context.itemDomElements,
    labelsRef: store.context.itemLabels,
    onMapChange: () => syncHighlightedItem(),
  });


  const { element, positioning: positioner } = createPopupPositioner(store, componentProps, {
    get keepMounted() {
      return keepMounted();
    },
    positioning: {
      get anchor() {
        const currentParent = parent();
        if (currentParent.type === 'context-menu') {
          return componentProps.anchor ?? currentParent.context.anchor;
        }
        return componentProps.anchor;
      },
      get collisionAvoidance() {
        return collisionAvoidance();
      },
      get positionMethod() {
        return contextMenuContext ? 'fixed' : componentProps.positionMethod;
      },
      get side() {
        return side();
      },
      get sideOffset() {
        return contextMenuOffsets()
          ? (componentProps.sideOffset ?? -5)
          : componentProps.sideOffset;
      },
      get align() {
        return align();
      },
      get alignOffset() {
        return contextMenuOffsets() ? (componentProps.alignOffset ?? 2) : componentProps.alignOffset;
      },
      get arrowPadding() {
        return isContextMenu() ? 0 : componentProps.arrowPadding;
      },
      nodeId: initialNodeId,
      get shift() {
        if (!isContextMenu()) {
          return undefined;
        }
        const avoidance = collisionAvoidance();
        return {
          crossAxis: !('side' in avoidance && avoidance.side === 'flip'),
          rootBoundary: 'layoutViewport' as const,
        };
      },
      externalTree: untrack(floatingTreeRoot),
      lazyFlip: virtualFocus ? 'placement' : false,
    },
    state: {
      get nested() {
        return parent().type === 'menu';
      },
    },
    // The children are created inside the positioner element: provide the contexts there.
    renderChildren: (positioning) => (
      <MenuPositionerContext value={positioning}>
        <FloatingNode id={floatingNodeId()}>
          <CompositeList list={list}>{componentProps.children}</CompositeList>
        </FloatingNode>
      </MenuPositionerContext>
    ),
  });

  const open = () => store.select('open');
  const mounted = () => store.select('mounted');

  // A detached trigger can move the popup to another floating tree node while it's mounted: keep
  // the positioning context attached to the current node.
  const positioningContext = positioner.context;
  Object.defineProperty(positioningContext, 'nodeId', {
    configurable: true,
    enumerable: true,
    get: () => store.select('floatingNodeId'),
  });
  createEffect(
    () => [floatingTreeRoot(), floatingNodeId()] as const,
    ([tree, nodeId]) => {
      const node = tree.nodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        node.context = positioningContext;
      }
    },
  );

  createEffect(
    () => [floatingTreeRoot(), floatingNodeId()] as const,
    ([tree, nodeId]) => {
      function onMenuOpenChange(details: MenuOpenEventDetails) {
        if (details.open) {
          if (details.parentNodeId === nodeId) {
            store.set('hoverEnabled', false);
          }
          // A submenu that is already closed has nothing to close, and a dropped close would
          // cancel a hover open it has pending. This mirrors the drop rule in `setOpen`.
          if (
            details.nodeId !== nodeId &&
            details.parentNodeId === store.state.floatingParentNodeId &&
            (store.state.open || store.state.openProp)
          ) {
            store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
          }
        }
      }

      tree.events.on('menuopenchange', onMenuOpenChange);
      return () => {
        tree.events.off('menuopenchange', onMenuOpenChange);
      };
    },
  );

  createEffect(
    () => [floatingTreeRoot(), floatingParentNodeId()] as const,
    ([tree, parentNodeId]) => {
      if (parentNodeId == null) {
        return undefined;
      }

      function onParentClose(details: MenuOpenEventDetails) {
        if (details.open || details.nodeId !== store.state.floatingParentNodeId) {
          return;
        }

        const reason: MenuRoot.ChangeEventReason = details.reason ?? REASONS.siblingOpen;
        store.setOpen(false, createChangeEventDetails(reason));
      }

      tree.events.on('menuopenchange', onParentClose);
      return () => {
        tree.events.off('menuopenchange', onParentClose);
      };
    },
  );

  const closeTimeout = new Timeout();
  onCleanup(closeTimeout.clear);

  // Clear pending close timeout when the menu closes.
  createEffect(open, (isOpen) => {
    if (!isOpen) {
      closeTimeout.clear();
    }
  });

  // Close unrelated child submenus when hovering a different item in the parent menu.
  createEffect(
    () => [floatingTreeRoot(), open(), triggerElement()] as const,
    ([tree, isOpen, currentTriggerElement]) => {
      function onItemHover(event: { nodeId: string | undefined; target: Element | null }) {
        // If an item within our parent menu is hovered, and this menu's trigger is not that item,
        // close this submenu. This ensures hovering a different item in the parent closes other
        // branches.
        if (!isOpen || event.nodeId !== store.state.floatingParentNodeId) {
          return;
        }

        if (event.target && currentTriggerElement && currentTriggerElement !== event.target) {
          const delay = store.state.closeDelay;
          if (delay > 0) {
            if (!closeTimeout.isStarted()) {
              closeTimeout.start(delay, () => {
                store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
              });
            }
          } else {
            store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
          }
        } else {
          // User re-hovered the submenu trigger, cancel pending close.
          closeTimeout.clear();
        }
      }

      tree.events.on('itemhover', onItemHover);
      return () => {
        tree.events.off('itemhover', onItemHover);
      };
    },
  );

  createEffect(
    () => [floatingTreeRoot(), open(), floatingNodeId(), floatingParentNodeId()] as const,
    ([tree, isOpen, nodeId, parentNodeId]) => {
      const eventDetails: MenuOpenEventDetails = {
        open: isOpen,
        nodeId,
        parentNodeId,
        reason: store.state.openChangeReason,
      };

      tree.events.emit('menuopenchange', eventDetails);
    },
  );

  createTriggerSwitchTransition({
    store,
    get domReference() {
      return store.select('anchorElement');
    },
    get positionerElement() {
      return positionerElement();
    },
    get open() {
      return open();
    },
  });

  const menubarModal = () => {
    const currentParent = parent();
    return currentParent.type === 'menubar' && currentParent.context.modal;
  };
  const popupModal = () => modal() && lastOpenChangeReason() !== REASONS.triggerHover;

  createAnchoredPopupScrollLock(
    () => open() && (menubarModal() || popupModal()),
    () => openMethod() === 'touch',
    positionerElement,
    triggerElement,
  );

  const shouldRenderBackdrop = () => {
    const currentParent = parent();
    return (
      mounted() &&
      currentParent.type !== 'menu' &&
      ((currentParent.type !== 'menubar' &&
        modal() &&
        lastOpenChangeReason() !== REASONS.triggerHover) ||
        (currentParent.type === 'menubar' && currentParent.context.modal))
    );
  };

  // Cuts a hole in the backdrop to allow pointer interaction with the menubar or dropdown menu
  // trigger element.
  const backdropCutout = (): Element | null => {
    const currentParent = parent();
    if (currentParent.type === 'menubar') {
      return currentParent.context.contentElement;
    }
    if (currentParent.type === undefined) {
      return triggerElement();
    }
    return null;
  };

  return (
    <>
      <Show when={shouldRenderBackdrop()}>
        <MenuInternalBackdrop cutout={backdropCutout()} />
      </Show>
      {element}
    </>
  );
}

/**
 * The transparent backdrop of a modal menu, registered in the context menu so its trigger can
 * tell presses on it apart.
 */
function MenuInternalBackdrop(props: { cutout: Element | null }) {
  const { store } = useMenuRootContext();
  let element: HTMLDivElement | undefined;
  const contextMenuRef = () => {
    const parent = store.state.parent;
    return parent.type === 'context-menu' || parent.type === 'nested-context-menu'
      ? parent.context.internalBackdropRef
      : undefined;
  };
  onCleanup(() => {
    const target = contextMenuRef();
    if (target && target.current === element) {
      target.current = null;
    }
  });
  return (
    <InternalBackdrop
      ref={(el: HTMLDivElement) => {
        element = el;
        const target = contextMenuRef();
        if (target) {
          target.current = el;
        }
      }}
      inert={!store.select('open')}
      cutout={props.cutout}
    />
  );
}

export interface MenuPositionerState {
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * Whether the component is nested.
   */
  nested: boolean;
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: string | undefined;
}

export interface MenuPositionerProps
  extends Omit<CreateAnchorPositioningSharedParameters, 'side' | 'align'>,
    BaseUIComponentProps<'div', MenuPositionerState> {
  /**
   * How to align the popup relative to the specified side.
   *
   * Submenus and menubars default to `'start'`.
   * @default 'center'
   */
  align?: CreateAnchorPositioningSharedParameters['align'] | undefined;
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   *
   * Submenus and vertical menubars default to `'inline-end'`.
   * @default 'bottom'
   */
  side?: CreateAnchorPositioningSharedParameters['side'] | undefined;
}

export namespace MenuPositioner {
  export type State = MenuPositionerState;
  export type Props = MenuPositionerProps;
}
