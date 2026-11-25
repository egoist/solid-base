import { createContext, useContext, type Accessor } from 'solid-js';

export const NavigationMenuPortalContext = createContext<Accessor<boolean> | null>(null);

export function useNavigationMenuPortalContext(): Accessor<boolean> {
  const value = useContext(NavigationMenuPortalContext);
  if (value == null) {
    throw new Error('Base UI: <NavigationMenu.Portal> is missing.');
  }
  return value;
}
