import { createContext, useContext } from 'solid-js';
import type { CreateAnchorPositioningReturnValue } from '../../internals/anchorPositioning';

/**
 * The live positioning of the menu (`createAnchorPositioning`'s return value).
 */
export type MenuPositionerContext = Pick<
  CreateAnchorPositioningReturnValue,
  'side' | 'align' | 'arrowRef' | 'arrowUncentered' | 'arrowStyles' | 'context'
>;

export const MenuPositionerContext = createContext<MenuPositionerContext | null>(null);

export function useMenuPositionerContext(optional?: false): MenuPositionerContext;
export function useMenuPositionerContext(optional: true): MenuPositionerContext | undefined;
export function useMenuPositionerContext(optional?: boolean) {
  const context = useContext(MenuPositionerContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: MenuPositionerContext is missing. MenuPositioner parts must be placed within <Menu.Positioner>.',
    );
  }
  return context ?? undefined;
}
