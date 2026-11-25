import { createContext, useContext } from 'solid-js';
import type { CreateAnchorPositioningReturnValue } from '../../internals/anchorPositioning';

/**
 * The live positioning of the preview card (`side`, `align`, `arrowRef`, `arrowStyles`…).
 */
export type PreviewCardPositionerContext = CreateAnchorPositioningReturnValue;

export const PreviewCardPositionerContext = createContext<PreviewCardPositionerContext | null>(null);

export function usePreviewCardPositionerContext(): PreviewCardPositionerContext {
  const context = useContext(PreviewCardPositionerContext);
  if (!context) {
    throw new Error(
      'Base UI: PreviewCardPositionerContext is missing. PreviewCardPositioner parts must be placed within <PreviewCard.Positioner>.',
    );
  }
  return context;
}
