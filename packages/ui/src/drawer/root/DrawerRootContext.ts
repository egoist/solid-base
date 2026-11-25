import { createContext, useContext } from 'solid-js';
import type { SwipeDirection } from '../../utils/swipeDismiss';
import type { DrawerRootSnapPointChangeEventDetails } from './DrawerRoot';

export type DrawerSwipeDirection = SwipeDirection;
export type DrawerSnapPoint = number | string;

export interface DrawerNestedSwipeProgressStore {
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
}

/**
 * The Drawer Root context. Values are live getters (tracked when read in a reactive scope);
 * callbacks are stable.
 */
export interface DrawerRootContext {
  readonly swipeDirection: DrawerSwipeDirection;
  /**
   * Whether `Drawer.SwipeArea` is currently driving an open gesture (writing the popup's
   * swipe-movement vars imperatively). The viewport reads this to skip resetting them on open.
   */
  readonly swipeAreaActiveRef: { current: boolean };
  /**
   * Whether to disable velocity-based snap skipping.
   */
  readonly snapToSequentialPoints: boolean;
  /**
   * Snap points used to size/position the drawer.
   */
  readonly snapPoints: DrawerSnapPoint[] | undefined;
  /**
   * The currently active snap point.
   */
  readonly activeSnapPoint: DrawerSnapPoint | null;
  /**
   * Updates the currently active snap point.
   */
  setActiveSnapPoint: (
    snapPoint: DrawerSnapPoint | null,
    eventDetails?: DrawerRootSnapPointChangeEventDetails,
  ) => void;
  /**
   * The measured height of the frontmost open drawer within the current nested drawer stack.
   */
  readonly frontmostHeight: number;
  /**
   * The measured height of the drawer popup element.
   */
  readonly popupHeight: number;
  /**
   * Whether the current drawer has a nested drawer mounted in its stack (including while it is
   * transitioning out).
   */
  readonly hasNestedDrawer: boolean;
  /**
   * Called by the drawer popup to report its own measured height.
   */
  onPopupHeightChange: (height: number) => void;
  /**
   * Whether a nested drawer is currently being swiped.
   */
  readonly nestedSwiping: boolean;
  /**
   * Provides nested swipe progress without re-rendering the drawer tree.
   */
  readonly nestedSwipeProgressStore: DrawerNestedSwipeProgressStore;
  /**
   * Called by a nested drawer to register its presence and frontmost height (accessors). Returns
   * the function that unregisters it.
   */
  registerNestedDrawer: (nested: NestedDrawerRegistration) => () => void;
  /**
   * Reports the frontmost height of a nested drawer stack imperatively (0 once it closes).
   * Nested drawers register theirs instead (`registerNestedDrawer`).
   */
  onNestedFrontmostHeightChange: (height: number) => void;
  /**
   * Called by a nested drawer to report whether it's being swiped.
   */
  onNestedSwipingChange: (swiping: boolean) => void;
  /**
   * Called by a nested drawer to report its swipe progress.
   */
  onNestedSwipeProgressChange: (progress: number) => void;
  /**
   * Provided to nested drawers so they can report swiping to the parent drawer.
   */
  readonly notifyParentSwipingChange?: ((swiping: boolean) => void) | undefined;
  /**
   * Provided to nested drawers so they can report swipe progress to the parent drawer.
   */
  readonly notifyParentSwipeProgressChange?: ((progress: number) => void) | undefined;
  /**
   * Provided to nested drawers so they can register with the parent drawer.
   */
  readonly registerWithParentDrawer?: ((nested: NestedDrawerRegistration) => () => void) | undefined;
}

/**
 * What a nested drawer registers with its parent drawer. Both are read while tracked.
 */
export interface NestedDrawerRegistration {
  /** Whether the nested drawer is still present (open or transitioning out). */
  present: () => boolean;
  /** The frontmost height of the nested drawer's stack while it is open, 0 otherwise. */
  frontmostHeight: () => number;
}

export const DrawerRootContext = createContext<DrawerRootContext | null>(null);

export function useDrawerRootContext(optional?: false): DrawerRootContext;
export function useDrawerRootContext(optional: true): DrawerRootContext | undefined;
export function useDrawerRootContext(optional?: boolean) {
  const drawerRootContext = useContext(DrawerRootContext);

  if (optional !== true && drawerRootContext == null) {
    throw new Error(
      'Base UI: DrawerRootContext is missing. Drawer parts must be placed within <Drawer.Root>.',
    );
  }

  return drawerRootContext ?? undefined;
}
