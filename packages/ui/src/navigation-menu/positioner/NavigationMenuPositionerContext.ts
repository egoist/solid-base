import { createContext, useContext } from 'solid-js';
import type { CreateAnchorPositioningReturnValue } from '../../internals/anchorPositioning';

export type NavigationMenuPositionerContext = CreateAnchorPositioningReturnValue;

export const NavigationMenuPositionerContext =
  createContext<NavigationMenuPositionerContext | null>(null);

export function useNavigationMenuPositionerContext(
  optional: true,
): NavigationMenuPositionerContext | undefined;
export function useNavigationMenuPositionerContext(
  optional?: false,
): NavigationMenuPositionerContext;
export function useNavigationMenuPositionerContext(optional = false) {
  const context = useContext(NavigationMenuPositionerContext);
  if (!context && !optional) {
    throw new Error(
      'Base UI: NavigationMenuPositionerContext is missing. NavigationMenuPositioner parts must be placed within <NavigationMenu.Positioner>.',
    );
  }
  return context ?? undefined;
}
