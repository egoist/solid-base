import { platform } from '@egoist/solid-base-utils/platform';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { HTMLProps } from '../../internals/types';
import type { MenuStore } from '../store/MenuStore';
import { REASONS } from '../../internals/reasons';
import { useContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import type { FloatingTreeStore } from '../../utils/popups/tree/FloatingTreeStore';
import type { MenuItemMetadata } from './createMenuItem';

function preventMouseDownDefault(event: MouseEvent) {
  event.preventDefault();
}

/**
 * Parameters of `createMenuItemCommonProps`. Read lazily (pass getters for reactive values).
 */
export interface CreateMenuItemCommonPropsParameters {
  /**
   * Whether to close the menu when the item is clicked.
   */
  readonly closeOnClick: boolean;
  /**
   * Determines if the menu item is highlighted.
   */
  readonly highlighted: boolean;
  /**
   * The id of the menu item.
   */
  readonly id: string | undefined;
  /**
   * The node id of the menu positioner.
   */
  readonly nodeId: string | undefined;
  /**
   * The menu store.
   */
  store: MenuStore<any>;
  /**
   * Whether a typeahead session is in progress.
   */
  typingRef?: RefObject<boolean> | undefined;
  /**
   * Returns the item element.
   */
  getItemElement: () => HTMLElement | null;
  /**
   * Metadata for checking item type before triggering click. Read once.
   */
  itemMetadata: MenuItemMetadata;
}

/**
 * Returns common props shared by all menu item types: id, role, tabindex, and the interaction
 * handlers. The returned object is created once; reactive values are getters.
 */
export function createMenuItemCommonProps(params: CreateMenuItemCommonPropsParameters): HTMLProps {
  const { store, typingRef, itemMetadata } = params;

  const rootContext = useMenuRootContext();
  const contextMenuContext = useContextMenuRootContext(true);

  // A submenu trigger is an item of the parent menu's list, so it follows that list's focus model.
  const isSubmenuTrigger = itemMetadata.type === 'submenu-trigger';
  const virtualFocus = isSubmenuTrigger ? rootContext.parentVirtualFocus : rootContext.virtualFocus;
  const selectionStore =
    isSubmenuTrigger && rootContext.parent.type === 'menu'
      ? rootContext.parent.store
      : rootContext.store;

  const isContextMenu = contextMenuContext !== undefined;

  const menuEvents = () => (store.select('floatingTreeRoot') as FloatingTreeStore).events;

  const props: HTMLProps = {
    get id() {
      return params.id;
    },
    role: 'menuitem',
    // `-1` rather than omitting it, which leaves links and buttons in the tab order.
    get tabindex() {
      return !virtualFocus && store.select('highlightedWhileOpen', params.highlighted) ? 0 : -1;
    },
    get 'aria-selected'() {
      return selectionStore.select('webkitAriaSelected', params.highlighted);
    },
    onKeyDown(event: KeyboardEvent) {
      if (event.key === ' ' && typingRef?.current) {
        event.preventDefault();
      }
    },
    onMouseMove(event: MouseEvent) {
      const nodeId = params.nodeId;
      if (!nodeId) {
        return;
      }

      // Inform the floating tree that a menu item within this menu was hovered/moved over
      // so unrelated descendant submenus can be closed.
      menuEvents().emit('itemhover', {
        nodeId,
        target: event.currentTarget,
      });
    },
    onClick(event: MouseEvent) {
      if (params.closeOnClick) {
        menuEvents().emit('close', { domEvent: event, reason: REASONS.itemPress });
      }
    },
    onMouseUp(event: MouseEvent) {
      if (contextMenuContext) {
        const initialCursorPoint = contextMenuContext.initialCursorPointRef.current;
        contextMenuContext.initialCursorPointRef.current = null;
        if (
          isContextMenu &&
          initialCursorPoint &&
          Math.abs(event.clientX - initialCursorPoint.x) <= 1 &&
          Math.abs(event.clientY - initialCursorPoint.y) <= 1
        ) {
          return;
        }

        // On non-macOS platforms, this mouseup belongs to the right-click gesture
        // that opened the context menu, so it must not activate an item.
        if (isContextMenu && !platform.os.mac && event.button === 2) {
          return;
        }
      }

      const itemElement = params.getItemElement();
      if (
        itemElement &&
        itemMetadata.type === 'regular-item' &&
        store.context.allowMouseUpTriggerRef.current &&
        (!isContextMenu || event.button === 2)
      ) {
        // Drag release has no mousedown on this item. Focus it before activation so
        // arrow navigation continues from it when the menu stays open.
        if (!virtualFocus) {
          itemElement.focus({ preventScroll: true });
        }
        // The press started on the trigger and was released over the item, so the item
        // needs a synthetic click. Its `closeOnClick` preference still applies.
        // `detail: 1` and `pointerType: 'mouse'` mark this as a mouse-gesture click so
        // MenuRoot and FloatingFocusManager don't treat it as a keyboard activation.
        dispatchClickWithModifiers(itemElement, event, {
          detail: 1,
          pointerType: 'mouse',
        });
      }
    },
  };

  if (virtualFocus) {
    // Real focus stays on the input or list that owns virtual navigation.
    (props as Record<string, unknown>).onMouseDown = preventMouseDownDefault;
  }

  return props;
}
