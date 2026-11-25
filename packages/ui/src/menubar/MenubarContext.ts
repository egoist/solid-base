import { createContext, useContext } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { MenuRoot } from '../menu/root/MenuRoot';

/**
 * The Menubar context. A live object: its properties are getters.
 */
export interface MenubarContext {
  readonly modal: boolean;
  readonly disabled: boolean;
  readonly contentElement: HTMLElement | null;
  setContentElement: (element: HTMLElement | null) => void;
  readonly hasSubmenuOpen: boolean;
  setHasSubmenuOpen: (open: boolean) => void;
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
