import { createContext, useContext } from 'solid-js';
import type { CheckboxRootState } from './CheckboxRoot';

export type CheckboxRootContextValue = CheckboxRootState;

export const CheckboxRootContext = createContext<CheckboxRootContextValue | null>(null);

export function useCheckboxRootContext(): CheckboxRootContextValue {
  const context = useContext(CheckboxRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: CheckboxRootContext is missing. Checkbox parts must be placed within <Checkbox.Root>.',
    );
  }

  return context;
}
