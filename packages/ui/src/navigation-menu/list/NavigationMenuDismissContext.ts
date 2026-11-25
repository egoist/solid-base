import { createContext, useContext } from 'solid-js';
import type { HTMLProps } from '../../internals/types';

/**
 * The dismiss props of the active trigger's store, published by `NavigationMenu.List` for its
 * triggers. A live props source: it follows the active store.
 */
export const NavigationMenuDismissContext = createContext<HTMLProps | null>(null);

export function useNavigationMenuDismissContext() {
  return useContext(NavigationMenuDismissContext);
}
