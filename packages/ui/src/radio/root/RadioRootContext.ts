import { createContext, useContext } from 'solid-js';
import type { RadioRootState } from './RadioRoot';

export type RadioRootContextValue = RadioRootState;

export const RadioRootContext = createContext<RadioRootContextValue | null>(null);

export function useRadioRootContext(): RadioRootContextValue {
  const context = useContext(RadioRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: RadioRootContext is missing. Radio parts must be placed within <Radio.Root>.',
    );
  }

  return context;
}
