import { createContext, useContext } from 'solid-js';
import type { CreateAnchorPositioningReturnValue } from '../../internals/anchorPositioning';

export type ComboboxPositionerContext = Pick<
  CreateAnchorPositioningReturnValue,
  | 'side'
  | 'align'
  | 'arrowRef'
  | 'arrowUncentered'
  | 'arrowStyles'
  | 'anchorHidden'
  | 'isPositioned'
>;

export const ComboboxPositionerContext = createContext<ComboboxPositionerContext | null>(null);

export function useComboboxPositionerContext(optional?: false): ComboboxPositionerContext;
export function useComboboxPositionerContext(optional: true): ComboboxPositionerContext | null;
export function useComboboxPositionerContext(optional?: boolean) {
  const context = useContext(ComboboxPositionerContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: <Combobox.Popup> and <Combobox.Arrow> must be used within the <Combobox.Positioner> component',
    );
  }
  return context;
}
