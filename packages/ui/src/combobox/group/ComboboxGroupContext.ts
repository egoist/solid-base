import { createContext, useContext, type Accessor } from 'solid-js';
import type { StateSetter } from '../../internals/labelable-provider/LabelableContext';

export interface ComboboxGroupContext {
  labelId: Accessor<string | undefined>;
  setLabelId: StateSetter<string | undefined>;
  items: Accessor<readonly any[] | undefined>;
}

export const ComboboxGroupContext = createContext<ComboboxGroupContext | null>(null);

export function useComboboxGroupContext() {
  const context = useContext(ComboboxGroupContext);
  if (context == null) {
    throw new Error(
      'Base UI: ComboboxGroupContext is missing. ComboboxGroup parts must be placed within <Combobox.Group>.',
    );
  }
  return context;
}
