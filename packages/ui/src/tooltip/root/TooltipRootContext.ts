import { createContext, useContext } from 'solid-js';
import type { TooltipStore } from '../store/TooltipStore';

export type TooltipRootContext<Payload = unknown> = TooltipStore<Payload>;

export const TooltipRootContext = createContext<TooltipStore<unknown> | null>(null);

export function useTooltipRootContext(optional?: false): TooltipStore<unknown>;
export function useTooltipRootContext(optional: true): TooltipStore<unknown> | null;
export function useTooltipRootContext(optional?: boolean) {
  const store = useContext(TooltipRootContext);
  if (store == null && !optional) {
    throw new Error(
      'Base UI: TooltipRootContext is missing. Tooltip parts must be placed within <Tooltip.Root>.',
    );
  }
  return store;
}
