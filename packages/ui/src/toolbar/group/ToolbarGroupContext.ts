import { createContext, useContext } from 'solid-js';

export interface ToolbarGroupContextValue {
  readonly disabled: boolean;
}

export const ToolbarGroupContext = createContext<ToolbarGroupContextValue | null>(null);

export function useToolbarGroupContext(): ToolbarGroupContextValue | undefined {
  return useContext(ToolbarGroupContext) ?? undefined;
}
