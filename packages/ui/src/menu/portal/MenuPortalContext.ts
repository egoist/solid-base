import { createContext, useContext, type Accessor } from 'solid-js';

export const MenuPortalContext = createContext<Accessor<boolean> | null>(null);

/**
 * Returns whether the portal keeps the popup mounted while it's closed.
 */
export function useMenuPortalContext(): Accessor<boolean> {
  const value = useContext(MenuPortalContext);
  if (value == null) {
    throw new Error('Base UI: <Menu.Portal> is missing.');
  }
  return value;
}
