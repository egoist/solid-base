import { createEffect, createMemo, createSignal, omit, onCleanup, untrack, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { createControllableSignal } from '@egoist/solid-base-utils/controlled';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { activeElement, contains } from '@egoist/solid-base-utils/shadowDom';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import {
  FloatingNode,
  FloatingTree,
  createFloatingNodeId,
  useFloatingParentNodeId,
} from '../../utils/popups/tree/FloatingTree';
import type { FloatingRootStore } from '../../utils/popups/floating-root/FloatingRootStore';
import { ReactiveStore } from '../../utils/popups/reactiveStore';
import { renderElement } from '../../internals/renderElement';
import {
  NavigationMenuRootContext,
  NavigationMenuTreeContext,
  useNavigationMenuRootContext,
} from './NavigationMenuRootContext';
import type {
  NavigationMenuActivationDirection,
  NavigationMenuPopupAutoSizeResetState,
} from './NavigationMenuRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { createUnmountAfterClose } from '../../internals/unmountAfterClose';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import { createActionsRef, type ActionsRef } from '../../internals/actionsRef';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { REASONS } from '../../internals/reasons';
import * as NavigationMenuPositionerCssVars from '../positioner/NavigationMenuPositionerCssVars';
import { setSharedFixedSize } from '../utils/setSharedFixedSize';

const blockedReturnFocusReasons = new Set<string>([
  REASONS.triggerHover,
  REASONS.outsidePress,
  REASONS.focusOut,
]);

function getPositionerFixedSize(positionerElement: HTMLElement) {
  // Read the last fixed positioner size rather than measuring the popup now:
  // during a controlled close, the popup can already be in its exit render and
  // report 0 before the closing transition gets a stable size to animate from.
  const width =
    parseFloat(
      positionerElement.style.getPropertyValue(NavigationMenuPositionerCssVars.positionerWidth),
    ) || 0;
  const height =
    parseFloat(
      positionerElement.style.getPropertyValue(NavigationMenuPositionerCssVars.positionerHeight),
    ) || 0;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

interface FloatingRootStoreRegistration {
  isActive: Accessor<boolean>;
  store: FloatingRootStore;
}

interface NavigationMenuRootStoreState {
  value: any;
  mounted: boolean;
  transitionStatus: TransitionStatus;
  delay: number;
  closeDelay: number;
  orientation: 'horizontal' | 'vertical';
  positionerElement: HTMLElement | null;
  popupElement: HTMLElement | null;
  viewportElement: HTMLElement | null;
  viewportTargetElement: HTMLElement | null;
  activationDirection: NavigationMenuActivationDirection;
  floatingRootStore: FloatingRootStore | undefined;
  viewportInert: boolean;
  preventUnmountOnClose: boolean;
  currentContent: HTMLElement | null;
}

/**
 * Groups all parts of the navigation menu.
 * Renders a `<nav>` element at the root, or `<div>` element when nested.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuRoot<Value = any>(
  componentProps: NavigationMenuRoot.Props<Value>,
): JSX.Element {
  const nested = useFloatingParentNodeId() != null;
  const parentRootContext = useNavigationMenuRootContext(true);

  const [value, setValueUnwrapped] = createControllableSignal<NavigationMenuRoot.Value<Value>>({
    value: () => componentProps.value,
    defaultValue: () => componentProps.defaultValue ?? null,
  });

  // Derive open state from value being non-nullish
  const open = () => value() != null;

  // Reads of this store are current outside reactive scopes (handlers, effect `apply` phases),
  // which the imperative sizing and focus logic relies on.
  const store = new ReactiveStore<NavigationMenuRootStoreState, object>({
    value: null,
    mounted: false,
    transitionStatus: undefined,
    delay: 50,
    closeDelay: 50,
    orientation: 'horizontal',
    positionerElement: null,
    popupElement: null,
    viewportElement: null,
    viewportTargetElement: null,
    activationDirection: null,
    floatingRootStore: undefined,
    viewportInert: false,
    preventUnmountOnClose: false,
    currentContent: null,
  }, {});

  let closeReason: NavigationMenuRoot.ChangeEventReason | undefined;
  // Called as the popup unmounts, in the same batch.
  const popupUnmountListeners = new Set<() => void>();
  function onPopupUnmount(listener: () => void) {
    popupUnmountListeners.add(listener);
    return () => {
      popupUnmountListeners.delete(listener);
    };
  }
  const rootRef: RefObject<HTMLElement | null> = { current: null };
  const prevTriggerElementRef: RefObject<Element | null | undefined> = { current: null };
  const beforeInsideRef: RefObject<HTMLSpanElement | null> = { current: null };
  const afterInsideRef: RefObject<HTMLSpanElement | null> = { current: null };
  const beforeOutsideRef: RefObject<HTMLSpanElement | null> = { current: null };
  const afterOutsideRef: RefObject<HTMLSpanElement | null> = { current: null };
  // Shared across triggers so a newly active trigger can cancel a stale
  // popup auto-size reset scheduled by the previously active trigger.
  const popupAutoSizeResetRef: RefObject<NavigationMenuPopupAutoSizeResetState> = {
    current: { abortController: null, owner: null },
  };
  const currentContentRef: RefObject<HTMLElement | null> = {
    get current() {
      return store.state.currentContent;
    },
    set current(element) {
      store.set('currentContent', element);
    },
  };

  const {
    mounted,
    transitionStatus,
    preventUnmountingOnClose,
    forceUnmount: handleUnmount,
  } = createUnmountAfterClose({
    open,
    element: () => store.select('popupElement'),
    preventUnmountOnClose: () => store.select('preventUnmountOnClose'),
    setPreventUnmountOnClose: (prevent) => store.set('preventUnmountOnClose', prevent),
    onUnmount() {
      const popupElement = store.state.popupElement;
      const doc = ownerDocument(rootRef.current);
      const activeEl = activeElement(doc);

      const isReturnFocusBlocked = closeReason ? blockedReturnFocusReasons.has(closeReason) : false;

      const prevTriggerElement = prevTriggerElementRef.current;
      if (
        !isReturnFocusBlocked &&
        isHTMLElement(prevTriggerElement) &&
        (activeEl === ownerDocument(popupElement).body || contains(popupElement, activeEl)) &&
        popupElement
      ) {
        prevTriggerElement.focus({ preventScroll: true });
        prevTriggerElementRef.current = undefined;
      }

      // Callbacks are read when called, which can happen in an effect's apply phase.
      untrack(() => componentProps.onOpenChangeComplete)?.(false);
      store.set('activationDirection', null);
      releaseFloatingRootStore();
      popupUnmountListeners.forEach((listener) => listener());

      store.set('currentContent', null);
      closeReason = undefined;
    },
  });

  // The floating root store of the active item, which positions the popup against its trigger.
  // Triggers register theirs; the active one is followed as the value changes, and the last one is
  // kept after the value clears (a controlled close) until the menu is closed through `setValue` or
  // unmounts, which release it.
  const [floatingRootStores, setFloatingRootStores] = createSignal<
    readonly FloatingRootStoreRegistration[]
  >([], { ownedWrite: true, name: 'NavigationMenuRoot.floatingRootStores' });
  const [floatingRootStoreRelease, setFloatingRootStoreRelease] = createSignal(0, {
    ownedWrite: true,
    name: 'NavigationMenuRoot.floatingRootStoreRelease',
  });
  function releaseFloatingRootStore() {
    setFloatingRootStoreRelease((release) => release + 1);
  }
  const activeFloatingRootStore = createMemo<{
    store: FloatingRootStore | undefined;
    release: number;
  }>(
    (previous) => {
      const release = floatingRootStoreRelease();
      const active = floatingRootStores().find((registration) => registration.isActive());
      if (active) {
        return { store: active.store, release };
      }
      return { store: previous?.release === release ? previous.store : undefined, release };
    },
    {
      name: 'NavigationMenuRoot.activeFloatingRootStore',
      equals: (a, b) => a.store === b.store && a.release === b.release,
    },
  );
  const floatingRootStore = createMemo(() => activeFloatingRootStore().store, {
    name: 'NavigationMenuRoot.floatingRootStore',
  });

  function registerFloatingRootStore(registration: FloatingRootStoreRegistration) {
    setFloatingRootStores((registrations) => [...registrations, registration]);
    return () => {
      setFloatingRootStores((registrations) =>
        registrations.filter((entry) => entry !== registration),
      );
    };
  }

  store.bind('value', value);
  store.bind('floatingRootStore', floatingRootStore);
  store.bind('mounted', mounted);
  store.bind('transitionStatus', transitionStatus);
  store.bind('delay', () => componentProps.delay ?? 50);
  store.bind('closeDelay', () => componentProps.closeDelay ?? 50);
  store.bind('orientation', () => componentProps.orientation ?? 'horizontal');

  // The viewport target may be the animated element instead of the popup.
  createOpenChangeComplete({
    enabled: () => mounted() && !open() && !preventUnmountingOnClose(),
    open,
    element: () => store.select('viewportTargetElement'),
    onComplete() {
      if (!untrack(open)) {
        handleUnmount();
      }
    },
  });

  createEffect(
    () => ({
      open: open(),
      popupElement: store.select('popupElement'),
      positionerElement: store.select('positionerElement'),
    }),
    ({ open: isOpen, popupElement, positionerElement }) => {
      if (isOpen || !positionerElement || !popupElement) {
        return;
      }

      const closeTransitionSize = getPositionerFixedSize(positionerElement);

      if (!closeTransitionSize) {
        return;
      }

      // No cleanup is needed for this fixed size: if the popup unmounts, the inline
      // styles are removed with it. If it stays mounted, reopening runs the trigger's
      // sizing logic which clears these vars via `clearFixedSizes`/`setAutoSizes`.
      setSharedFixedSize(
        popupElement,
        positionerElement,
        closeTransitionSize.width,
        closeTransitionSize.height,
      );
    },
  );

  createEffect(value, () => {
    store.set('viewportInert', false);
  });

  function setValue(
    nextValue: NavigationMenuRoot.Value<Value>,
    eventDetails: Omit<NavigationMenuRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) {
    const currentValue = store.state.value;

    if (nextValue == null) {
      closeReason = eventDetails.reason;
    }

    const changeEventDetails = eventDetails as NavigationMenuRoot.ChangeEventDetails;
    // Navigation Menu only takes the request from `onValueChange` itself, not after an `await`.
    let unmountPrevented = false;
    changeEventDetails.preventUnmountOnClose = () => {
      unmountPrevented = true;
    };

    if (nextValue !== currentValue) {
      untrack(() => componentProps.onValueChange)?.(nextValue, changeEventDetails);
    }

    if (eventDetails.isCanceled) {
      return;
    }

    if (nextValue == null) {
      // A redundant close (for example the trigger's blur after an imperative close) skips
      // `onValueChange`, so it can't opt out again and must not discard the recorded opt-out.
      if (currentValue != null) {
        store.set('preventUnmountOnClose', unmountPrevented);
      }
      store.set('activationDirection', null);
      releaseFloatingRootStore();
    }

    setValueUnwrapped(nextValue);

    if (
      nested &&
      nextValue == null &&
      eventDetails.reason === REASONS.linkPress &&
      parentRootContext
    ) {
      parentRootContext.setValue(null, eventDetails);
    }
  }

  const actions: NavigationMenuRoot.Actions = {
    unmount: handleUnmount,
    close: () => setValue(null, createChangeEventDetails(REASONS.imperativeAction)),
  };
  createActionsRef(() => componentProps.actionsRef, actions);
  // Make the actions available to a ref object before the first effects run.
  const initialActionsRef = untrack(() => componentProps.actionsRef);
  if (initialActionsRef && typeof initialActionsRef === 'object') {
    initialActionsRef.current = actions;
  }

  const contextValue: NavigationMenuRootContext<Value> = {
    get open() {
      return store.select('value') != null;
    },
    get value() {
      return store.select('value');
    },
    setValue,
    get mounted() {
      return store.select('mounted');
    },
    get transitionStatus() {
      return store.select('transitionStatus');
    },
    get positionerElement() {
      return store.select('positionerElement');
    },
    setPositionerElement: store.setter('positionerElement'),
    get popupElement() {
      return store.select('popupElement');
    },
    setPopupElement: store.setter('popupElement'),
    get viewportElement() {
      return store.select('viewportElement');
    },
    setViewportElement: store.setter('viewportElement'),
    get viewportTargetElement() {
      return store.select('viewportTargetElement');
    },
    setViewportTargetElement: store.setter('viewportTargetElement'),
    get activationDirection() {
      return store.select('value') != null ? store.select('activationDirection') : null;
    },
    setActivationDirection: store.setter('activationDirection'),
    get floatingRootStore() {
      return store.select('floatingRootStore');
    },
    registerFloatingRootStore,
    onPopupUnmount,
    get currentContent() {
      return store.select('currentContent');
    },
    currentContentRef,
    nested,
    rootRef,
    beforeInsideRef,
    afterInsideRef,
    beforeOutsideRef,
    afterOutsideRef,
    prevTriggerElementRef,
    popupAutoSizeResetRef,
    get delay() {
      return store.select('delay');
    },
    get closeDelay() {
      return store.select('closeDelay');
    },
    get orientation() {
      return store.select('orientation');
    },
    get viewportInert() {
      return store.select('viewportInert');
    },
    setViewportInert: store.setter('viewportInert'),
  };

  const content = () => (
    <NavigationMenuRootContext value={contextValue}>
      <TreeContext componentProps={componentProps} />
    </NavigationMenuRootContext>
  );

  if (!nested) {
    // FloatingTree provides context to nested menus
    return <FloatingTree>{content()}</FloatingTree>;
  }

  return content();
}

function TreeContext<Value>(props: { componentProps: NavigationMenuRoot.Props<Value> }) {
  const componentProps = props.componentProps;
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'defaultValue',
    'value',
    'onValueChange',
    'actionsRef',
    'delay',
    'closeDelay',
    'orientation',
    'onOpenChangeComplete',
  );

  const nodeId = createFloatingNodeId();
  const context = useNavigationMenuRootContext();

  const state: NavigationMenuRootState = {
    get open() {
      return context.open;
    },
    nested: context.nested,
  };

  let rootElement: HTMLElement | null = null;
  onCleanup(() => {
    if (context.rootRef.current === rootElement) {
      context.rootRef.current = null;
    }
  });

  return (
    <NavigationMenuTreeContext value={{ id: nodeId }}>
      <FloatingNode id={nodeId}>
        {renderElement(context.nested ? 'div' : 'nav', componentProps, {
          state,
          ref: (el: HTMLElement) => {
            rootElement = el;
            context.rootRef.current = el;
          },
          props: elementProps,
        })}
      </FloatingNode>
    </NavigationMenuTreeContext>
  );
}

export interface NavigationMenuRootState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * Whether the navigation menu is nested.
   */
  nested: boolean;
}

export interface NavigationMenuRootProps<Value = any> extends BaseUIComponentProps<
  'nav',
  NavigationMenuRootState
> {
  /**
   * A ref to imperative actions.
   * - `unmount`: Ends the closing phase of the navigation menu popup after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `onValueChange` first, otherwise the navigation menu popup completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the navigation menu imperatively when called.
   */
  actionsRef?: ActionsRef<NavigationMenuRoot.Actions> | undefined;
  /**
   * Event handler called after any animations complete when the navigation menu is closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * The controlled value of the navigation menu item that should be currently open.
   * When non-nullish, the menu will be open. When nullish, the menu will be closed.
   *
   * To render an uncontrolled navigation menu, use the `defaultValue` prop instead.
   * @default null
   */
  value?: Value | null | undefined;
  /**
   * The uncontrolled value of the item that should be initially selected.
   *
   * To render a controlled navigation menu, use the `value` prop instead.
   * @default null
   */
  defaultValue?: Value | null | undefined;
  /**
   * Callback fired when the value changes.
   */
  onValueChange?:
    | ((value: Value | null, eventDetails: NavigationMenuRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * How long to wait before opening the navigation popup. Specified in milliseconds.
   * @default 50
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the navigation popup. Specified in milliseconds.
   * @default 50
   */
  closeDelay?: number | undefined;
  /**
   * The orientation of the navigation menu.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical' | undefined;
}

export interface NavigationMenuRootActions {
  unmount: () => void;
  close: () => void;
}

export type NavigationMenuRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.triggerHover
  | typeof REASONS.outsidePress
  | typeof REASONS.listNavigation
  | typeof REASONS.focusOut
  | typeof REASONS.escapeKey
  | typeof REASONS.linkPress
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type NavigationMenuRootChangeEventDetails =
  BaseUIChangeEventDetails<NavigationMenuRoot.ChangeEventReason> & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };

export namespace NavigationMenuRoot {
  export type State = NavigationMenuRootState;
  export type Props<TValue = any> = NavigationMenuRootProps<TValue>;
  export type Value<TValue = any> = TValue | null;
  export type Actions = NavigationMenuRootActions;
  export type ChangeEventReason = NavigationMenuRootChangeEventReason;
  export type ChangeEventDetails = NavigationMenuRootChangeEventDetails;
}
