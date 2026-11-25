import { createContext, useContext } from 'solid-js';

export interface DrawerProviderContext {
  setDrawerOpen: (drawer: object, open: boolean) => void;
  removeDrawer: (drawer: object) => void;
  /**
   * Registers whether a drawer is open (an accessor, read while tracked). Returns the function
   * that unregisters it.
   */
  registerDrawer: (open: () => boolean) => () => void;
  /** Whether any drawer within the provider is open (tracked). */
  readonly active: boolean;
  visualStateStore: DrawerVisualStateStore;
}

export const DrawerProviderContext = createContext<DrawerProviderContext | null>(null);

export interface DrawerVisualState {
  swipeProgress: number;
  frontmostHeight: number;
}

export interface DrawerVisualStateStore {
  getSnapshot: () => DrawerVisualState;
  subscribe: (listener: () => void) => () => void;
  set: (state: Partial<DrawerVisualState>) => void;
}

export function useDrawerProviderContext(): DrawerProviderContext | undefined {
  return useContext(DrawerProviderContext) ?? undefined;
}
