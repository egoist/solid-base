import { createContext, useContext } from 'solid-js';
import type { ToastObject } from '../useToastManager';

/**
 * A live object: its getters track the current values.
 */
export interface ToastRootContext {
  readonly toast: ToastObject<any>;
  setTitleId: (id: string | undefined | ((prev: string | undefined) => string | undefined)) => void;
  setDescriptionId: (
    id: string | undefined | ((prev: string | undefined) => string | undefined),
  ) => void;
  readonly visibleIndex: number;
  readonly expanded: boolean;
  recalculateHeight: (flushSync?: boolean) => void;
}

export const ToastRootContext = createContext<ToastRootContext | null>(null);

export function useToastRootContext(): ToastRootContext {
  const context = useContext(ToastRootContext);
  if (!context) {
    throw new Error(
      'Base UI: ToastRootContext is missing. Toast parts must be used within <Toast.Root>.',
    );
  }
  return context;
}
