import { createContext, useContext, type Accessor } from 'solid-js';

/**
 * Whether the tooltip portal keeps its content mounted while closed (`keepMounted`).
 */
export const TooltipPortalContext = createContext<Accessor<boolean> | null>(null);

export function useTooltipPortalContext() {
  const value = useContext(TooltipPortalContext);
  if (value == null) {
    throw new Error('Base UI: <Tooltip.Portal> is missing.');
  }
  return value;
}
