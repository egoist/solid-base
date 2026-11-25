import { createContext, useContext, type Accessor } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { MenuRoot } from '../menu/root/MenuRoot';

/**
 * The view of a menu store the menubar reads.
 */
export interface MenubarMenuStore {
  select(key: 'open'): boolean;
  select(key: 'parent'): { type: string | undefined; context?: unknown };
  select(key: 'lastOpenChangeReason'): string | null;
}

/**
 * The Menubar context. A live object: its properties are getters.
 */
export interface MenubarContext {
  readonly modal: boolean;
  readonly disabled: boolean;
  readonly contentElement: HTMLElement | null;
  setContentElement: (element: HTMLElement | null) => void;
  readonly hasSubmenuOpen: boolean;
  /**
   * Registers a menu that may belong to the menubar: the menus whose parent is this menubar
   * determine `hasSubmenuOpen`. Returns a function unregistering it.
   */
  registerMenu: (menu: Accessor<MenubarMenuStore>) => () => void;
  readonly orientation: MenuRoot.Orientation;
  readonly allowMouseUpTriggerRef: RefObject<boolean>;
  readonly rootId: string | undefined;
}

export const MenubarContext = createContext<MenubarContext | null>(null);

export function useMenubarContext(optional?: false): MenubarContext;
export function useMenubarContext(optional: true): MenubarContext | null;
export function useMenubarContext(optional?: boolean) {
  const context = useContext(MenubarContext);
  if (context === null && !optional) {
    throw new Error(
      'Base UI: MenubarContext is missing. Menubar parts must be placed within <Menubar>.',
    );
  }

  return context;
}
