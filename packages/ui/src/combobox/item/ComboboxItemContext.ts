import { createContext, useContext, type Accessor } from 'solid-js';

export interface ComboboxItemContext {
  selected: Accessor<boolean>;
}

export const ComboboxItemContext = createContext<ComboboxItemContext | null>(null);

export function useComboboxItemContext() {
  const context = useContext(ComboboxItemContext);
  if (!context) {
    throw new Error(
      'Base UI: ComboboxItemContext is missing. ComboboxItem parts must be placed within <Combobox.Item>.',
    );
  }
  return context;
}
