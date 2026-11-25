import { createContext, useContext, type Accessor } from 'solid-js';
import type { ToastObject } from '../useToastManager';

/**
 * A live object: its getters track the current values.
 */
export interface ToastRootContext {
  readonly toast: ToastObject<any>;
  /**
   * Registers the id of a title part: it labels the toast whenever `id` returns one.
   * Returns the unregister function.
   */
  registerTitleId: (id: Accessor<string | undefined>) => () => void;
  /**
   * Registers the id of a description part: it describes the toast whenever `id` returns one.
   * Returns the unregister function.
   */
  registerDescriptionId: (id: Accessor<string | undefined>) => () => void;
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
