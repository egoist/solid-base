import { createContext, useContext } from 'solid-js';

/**
 * The state of the enclosing radio item (a live object of getters).
 */
export interface MenuRadioItemContext {
  readonly checked: boolean;
  readonly highlighted: boolean;
  readonly disabled: boolean;
}

export const MenuRadioItemContext = createContext<MenuRadioItemContext | null>(null);

export function useMenuRadioItemContext() {
  const context = useContext(MenuRadioItemContext);
  if (context == null) {
    throw new Error(
      'Base UI: MenuRadioItemContext is missing. MenuRadioItem parts must be placed within <Menu.RadioItem>.',
    );
  }

  return context;
}
