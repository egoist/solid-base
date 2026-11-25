import { createContext, useContext, type Accessor } from 'solid-js';

/**
 * Whether the preview card portal keeps its content mounted while closed (`keepMounted`).
 */
export const PreviewCardPortalContext = createContext<Accessor<boolean> | null>(null);

export function usePreviewCardPortalContext() {
  const value = useContext(PreviewCardPortalContext);
  if (value == null) {
    throw new Error('Base UI: <PreviewCard.Portal> is missing.');
  }
  return value;
}
