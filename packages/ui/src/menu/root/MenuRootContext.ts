import { createContext, useContext, type Accessor } from 'solid-js';
import type { MenuStore } from '../store/MenuStore';
import type { MenuParent, MenuRoot } from './MenuRoot';

/**
 * The context of a `Menu.Root` (or `Menu.SubmenuRoot`). Created once; reactive values are getters.
 */
export interface MenuRootContext<Payload = unknown> {
  readonly store: MenuStore<Payload>;
  /** Where the Root sits (from context), unlike the store's `parent`, which a detached trigger overwrites. */
  readonly parent: MenuParent;
  readonly orientation: MenuRoot.Orientation;
  readonly loopFocus: boolean;
  /** Whether arrow keys can step from either end of the list back to a virtual focus owner. */
  readonly allowEscape: boolean;
  /** The generated popup id. */
  readonly generatedPopupId: Accessor<string | undefined>;
  /** Records the id the popup rendered with, when it differs from `generatedPopupId`. */
  setRenderedPopupId: (id: string | undefined) => void;
  /** Whether the menu keeps real focus on an element inside the popup (filterable menus). Fixed. */
  readonly virtualFocus: boolean;
  /** Whether the parent menu uses virtual focus. Fixed. */
  readonly parentVirtualFocus: boolean;
  /** Re-emits `onItemHighlighted` after the item registry settles. */
  syncHighlightedItem: () => void;
}

export const MenuRootContext = createContext<MenuRootContext | null>(null);

export function useMenuRootContext(optional?: false): MenuRootContext;
export function useMenuRootContext(optional: true): MenuRootContext | undefined;
export function useMenuRootContext(optional?: boolean) {
  const context = useContext(MenuRootContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: MenuRootContext is missing. Menu parts must be placed within <Menu.Root>.',
    );
  }

  return context ?? undefined;
}
