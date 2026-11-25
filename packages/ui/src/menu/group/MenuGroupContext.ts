import { createContext, useContext } from 'solid-js';

/**
 * Registers the id of the group's label (`undefined` clears it). Accepts an updater function.
 */
export type MenuGroupContext = (
  id: string | undefined | ((previous: string | undefined) => string | undefined),
) => void;

export const MenuGroupContext = createContext<MenuGroupContext | null>(null);

export function useMenuGroupRootContext() {
  const context = useContext(MenuGroupContext);
  if (context == null) {
    throw new Error(
      'Base UI: MenuGroupContext is missing. Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>.',
    );
  }

  return context;
}
