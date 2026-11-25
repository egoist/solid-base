import { createContext, useContext, type Accessor } from 'solid-js';
import type { StateSetter } from '../../internals/labelable-provider/LabelableContext';

export interface SelectGroupContext {
  labelId: Accessor<string | undefined>;
  setLabelId: StateSetter<string | undefined>;
}

export const SelectGroupContext = createContext<SelectGroupContext | null>(null);

export function useSelectGroupContext(): SelectGroupContext {
  const context = useContext(SelectGroupContext);
  if (context == null) {
    throw new Error(
      'Base UI: SelectGroupContext is missing. SelectGroup parts must be placed within <Select.Group>.',
    );
  }
  return context;
}
