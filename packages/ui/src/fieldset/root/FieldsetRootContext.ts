import { createContext, useContext, type Accessor } from 'solid-js';

export interface FieldsetRootContextValue {
  legendId: Accessor<string | undefined>;
  setLegendId: (
    next: string | undefined | ((prev: string | undefined) => string | undefined),
  ) => void;
  disabled: Accessor<boolean>;
}

export const FieldsetRootContext = createContext<FieldsetRootContextValue | null>(null);

export function useFieldsetRootContext(optional: true): FieldsetRootContextValue | null;
export function useFieldsetRootContext(optional?: false): FieldsetRootContextValue;
export function useFieldsetRootContext(optional = false) {
  const context = useContext(FieldsetRootContext);
  if (!context && !optional) {
    throw new Error(
      'Base UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>.',
    );
  }
  return context;
}
