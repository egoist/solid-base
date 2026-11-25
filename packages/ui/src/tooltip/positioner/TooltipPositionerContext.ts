import { createContext, useContext } from 'solid-js';
import type { CreateAnchorPositioningReturnValue } from '../../internals/anchorPositioning';

/**
 * The live positioning of the tooltip (`side`, `align`, `arrowRef`, `arrowStyles`…).
 */
export type TooltipPositionerContext = CreateAnchorPositioningReturnValue;

export const TooltipPositionerContext = createContext<TooltipPositionerContext | null>(null);

export function useTooltipPositionerContext(): TooltipPositionerContext {
  const context = useContext(TooltipPositionerContext);
  if (!context) {
    throw new Error(
      'Base UI: TooltipPositionerContext is missing. TooltipPositioner parts must be placed within <Tooltip.Positioner>.',
    );
  }
  return context;
}
