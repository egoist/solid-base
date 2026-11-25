import { createContext, useContext } from 'solid-js';
import type { Orientation } from '../../internals/types';

export interface ToolbarRootContextValue {
  readonly disabled: boolean;
  readonly orientation: Orientation;
}

export const ToolbarRootContext = createContext<ToolbarRootContextValue | null>(null);

export function useToolbarRootContext(optional?: false): ToolbarRootContextValue;
export function useToolbarRootContext(optional: true): ToolbarRootContextValue | undefined;
export function useToolbarRootContext(optional?: boolean) {
  const context = useContext(ToolbarRootContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: ToolbarRootContext is missing. Toolbar parts must be placed within <Toolbar.Root>.',
    );
  }

  return context ?? undefined;
}
