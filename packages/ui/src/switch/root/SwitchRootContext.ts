import { createContext, useContext } from 'solid-js';
import type { SwitchRootState } from './SwitchRoot';

export type SwitchRootContextValue = SwitchRootState;

export const SwitchRootContext = createContext<SwitchRootContextValue | null>(null);

export function useSwitchRootContext(): SwitchRootContextValue {
  const context = useContext(SwitchRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>.',
    );
  }

  return context;
}
