import { createContext, useContext, type Accessor } from 'solid-js';

export const ComboboxPortalContext = createContext<Accessor<boolean> | null>(null);

/**
 * Returns an accessor for the `keepMounted` prop of the closest `<Combobox.Portal>`.
 */
export function useComboboxPortalContext() {
  const context = useContext(ComboboxPortalContext);
  if (context == null) {
    throw new Error('Base UI: <Combobox.Portal> is missing.');
  }
  return context;
}
