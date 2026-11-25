import { createContext, useContext } from 'solid-js';

/**
 * Holds the provider's `delay` value (a live getter). `closeDelay` is handled by the delay group.
 */
export const TooltipProviderContext = createContext<{ readonly delay: number | undefined } | null>(
  null,
);

export function useTooltipProviderContext() {
  return useContext(TooltipProviderContext);
}
