import { createContext, useContext } from 'solid-js';
import type { CreateAnchorPositioningReturnValue } from '../../internals/anchorPositioning';

export type ToastPositionerContext = Pick<
  CreateAnchorPositioningReturnValue,
  'side' | 'align' | 'arrowRef' | 'arrowUncentered' | 'arrowStyles'
>;

export const ToastPositionerContext = createContext<ToastPositionerContext | null>(null);

export function useToastPositionerContext(): ToastPositionerContext {
  const context = useContext(ToastPositionerContext);
  if (!context) {
    throw new Error(
      'Base UI: ToastPositionerContext is missing. ToastPositioner parts must be placed within <Toast.Positioner>.',
    );
  }
  return context;
}
