import { createContext, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';

export interface DrawerViewportContextValue {
  /** Whether the popup is being swiped (tracked). */
  readonly swiping: boolean;
  /** The drag styles of the current swipe (tracked). */
  getDragStyles: () => JSX.CSSProperties;
  /** The swipe release strength scalar, or `null` (tracked). */
  readonly swipeStrength: number | null;
  setSwipeDismissed: (dismissed: boolean) => void;
}

export const DrawerViewportContext = createContext<DrawerViewportContextValue | null>(null);

export function useDrawerViewportContext() {
  return useContext(DrawerViewportContext);
}
