import { createContext, useContext } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { FloatingRootStore } from '../../utils/popups/floating-root/FloatingRootStore';
import type { TransitionStatus } from '../../internals/transitionStatus';
import type { NavigationMenuRoot } from './NavigationMenuRoot';

export type NavigationMenuPopupAutoSizeResetState = {
  abortController: AbortController | null;
  owner: any;
};

export type NavigationMenuActivationDirection = 'left' | 'right' | 'up' | 'down' | null;

/**
 * The live context of a `NavigationMenu.Root`. Its getters are reactive inside reactive scopes and
 * untracked (always current) snapshots elsewhere, such as in event handlers.
 */
export interface NavigationMenuRootContext<Value = any> {
  readonly open: boolean;
  readonly value: NavigationMenuRoot.Value<Value>;
  setValue: (
    value: NavigationMenuRoot.Value<Value>,
    eventDetails: Omit<NavigationMenuRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) => void;
  readonly transitionStatus: TransitionStatus;
  readonly mounted: boolean;
  readonly popupElement: HTMLElement | null;
  setPopupElement: (element: HTMLElement | null) => void;
  readonly positionerElement: HTMLElement | null;
  setPositionerElement: (element: HTMLElement | null) => void;
  readonly viewportElement: HTMLElement | null;
  setViewportElement: (element: HTMLElement | null) => void;
  readonly viewportTargetElement: HTMLElement | null;
  setViewportTargetElement: (element: HTMLElement | null) => void;
  readonly activationDirection: NavigationMenuActivationDirection;
  setActivationDirection: (direction: NavigationMenuActivationDirection) => void;
  readonly floatingRootStore: FloatingRootStore | undefined;
  /**
   * Registers the floating root store of an item's trigger: while `isActive`, it is the menu's
   * `floatingRootStore`. Returns the function that unregisters it.
   */
  registerFloatingRootStore: (registration: {
    isActive: () => boolean;
    store: FloatingRootStore;
  }) => () => void;
  /**
   * Subscribes to the popup's unmount: the listener runs as the popup unmounts, in the same batch.
   * Returns the function that unsubscribes it.
   */
  onPopupUnmount: (listener: () => void) => () => void;
  /**
   * The content element of the active item. Reading `currentContent` is tracked; the ref reads
   * and writes the same value imperatively.
   */
  readonly currentContent: HTMLElement | null;
  currentContentRef: RefObject<HTMLElement | null>;
  nested: boolean;
  rootRef: RefObject<HTMLElement | null>;
  beforeInsideRef: RefObject<HTMLSpanElement | null>;
  afterInsideRef: RefObject<HTMLSpanElement | null>;
  beforeOutsideRef: RefObject<HTMLSpanElement | null>;
  afterOutsideRef: RefObject<HTMLSpanElement | null>;
  prevTriggerElementRef: RefObject<Element | null | undefined>;
  popupAutoSizeResetRef: RefObject<NavigationMenuPopupAutoSizeResetState>;
  readonly delay: number;
  readonly closeDelay: number;
  readonly orientation: 'horizontal' | 'vertical';
  readonly viewportInert: boolean;
  setViewportInert: (inert: boolean) => void;
}

export const NavigationMenuRootContext = createContext<NavigationMenuRootContext<any> | null>(
  null,
);

function useNavigationMenuRootContext<Value = any>(
  optional?: false,
): NavigationMenuRootContext<Value>;
function useNavigationMenuRootContext<Value = any>(
  optional: true,
): NavigationMenuRootContext<Value> | undefined;
function useNavigationMenuRootContext<Value = any>(optional?: boolean) {
  const context = useContext(NavigationMenuRootContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: NavigationMenuRootContext is missing. Navigation Menu parts must be placed within <NavigationMenu.Root>.',
    );
  }
  return context ?? undefined;
}

/**
 * The floating tree node id of the closest `NavigationMenu.Root`.
 */
export const NavigationMenuTreeContext = createContext<{ id: string | undefined } | null>(null);

function useNavigationMenuTreeContext(): string | undefined {
  return useContext(NavigationMenuTreeContext)?.id;
}

export { useNavigationMenuRootContext, useNavigationMenuTreeContext };
