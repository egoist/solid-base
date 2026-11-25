import { createContext, useContext } from 'solid-js';
import type { CreateCollapsibleRootReturnValue } from './createCollapsibleRoot';
import type { CollapsibleRoot, CollapsibleRootState } from './CollapsibleRoot';

export interface CollapsibleRootContextValue extends CreateCollapsibleRootReturnValue {
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  /**
   * The live state of the root (an object of getters).
   */
  state: CollapsibleRootState;
}

export const CollapsibleRootContext = createContext<CollapsibleRootContextValue | null>(null);

export function useCollapsibleRootContext(): CollapsibleRootContextValue {
  const context = useContext(CollapsibleRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: CollapsibleRootContext is missing. Collapsible parts must be placed within <Collapsible.Root>.',
    );
  }

  return context;
}
