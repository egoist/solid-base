import { createContext, useContext, type Accessor } from 'solid-js';

export interface FieldItemContextValue {
  disabled: Accessor<boolean>;
}

const DEFAULT_FIELD_ITEM_CONTEXT: FieldItemContextValue = { disabled: () => false };

export const FieldItemContext = createContext<FieldItemContextValue | null>(null);

export function useFieldItemContext(): FieldItemContextValue {
  return useContext(FieldItemContext) ?? DEFAULT_FIELD_ITEM_CONTEXT;
}
