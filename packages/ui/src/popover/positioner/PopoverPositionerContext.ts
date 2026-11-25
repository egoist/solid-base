import { createContext, useContext } from 'solid-js';
import type { CreateAnchorPositioningReturnValue } from '../../internals/anchorPositioning';

/**
 * The live positioning of the popover (`side`, `align`, `arrowRef`, `arrowStyles`…).
 */
export type PopoverPositionerContext = CreateAnchorPositioningReturnValue;

export const PopoverPositionerContext = createContext<PopoverPositionerContext | null>(null);

export function usePopoverPositionerContext(): PopoverPositionerContext {
  const context = useContext(PopoverPositionerContext);
  if (!context) {
    throw new Error(
      'Base UI: PopoverPositionerContext is missing. PopoverPositioner parts must be placed within <Popover.Positioner>.',
    );
  }
  return context;
}
