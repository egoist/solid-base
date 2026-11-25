import { createEffect, onCleanup, untrack, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createActionsRef, type ActionsRef } from '../../internals/actionsRef';
import { createBaseUiId } from '../../internals/baseUiId';
import { createUnmountAfterClose } from '../../internals/unmountAfterClose';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { useFloatingParentNodeId } from './tree/FloatingTree';
import type { InteractionType } from './interactions/enhancedClickHandler';
import type { ReactiveStore } from './reactiveStore';
import type {
  PopupStoreState,
  PopupStoreContext,
  PopupStoreSelectors,
  PopupTriggerDataStore,
} from './store';

export interface PopupRootActions {
  unmount: () => void;
  close: () => void;
}

/**
 * Where a Root exposes its imperative actions: a ref object (`{ current: null }`) or a callback
 * receiving the actions (and `null` on unmount). See `internals/actionsRef.ts`.
 */
export type { ActionsRef };

/**
 * The props every popup Root shares.
 */
export interface PopupRootProps<OnOpenChange = (open: boolean, details: any) => void> {
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: OnOpenChange | undefined;
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  actionsRef?: ActionsRef<PopupRootActions> | undefined;
  triggerId?: string | null | undefined;
  defaultTriggerId?: string | null | undefined;
}

/**
 * The store state a popup Root derives from its props when it creates the store.
 */
export type PopupRootInitialState = Pick<
  PopupStoreState<unknown>,
  'open' | 'activeTriggerId'
>;

export interface CreatePopupRootOptions {
  /**
   * Whether the popup closes when its active trigger unmounts.
   * @default false
   */
  closeOnActiveTriggerUnmount?: boolean | undefined;
  /**
   * Whether a popup that mounts already open still plays its enter transition.
   * @default false
   */
  animateInitialOpen?: boolean | undefined;
  /**
   * Whether the popup renders as closed. Its open state in the store is left as it is.
   * @default () => false
   */
  disabled?: Accessor<boolean> | undefined;
}

/**
 * The popup store members a popup Root relies on.
 */
export type PopupRootStore = ReactiveStore<any, PopupStoreContext<any>, any> & {
  setOpen(
    open: boolean,
    eventDetails: BaseUIChangeEventDetails<typeof REASONS.imperativeAction | typeof REASONS.none>,
  ): void;
  resetOnUnmount(): void;
};

export interface CreatePopupRootReturnValue<Store> {
  store: Store;
  /** Whether the popup renders as open. */
  open: Accessor<boolean>;
  /** Whether the popup is mounted (open, or closing). */
  mounted: Accessor<boolean>;
  transitionStatus: Accessor<TransitionStatus>;
  /** Unmounts a popup kept mounted with `preventUnmountOnClose()`. */
  forceUnmount: () => void;
}

/**
 * Runs what every popup Root does for its popup: it creates the store, binds the controlled props
 * and callbacks, keeps the active trigger current, runs the open and close transitions, and
 * exposes the `actionsRef` actions.
 *
 * Call it in the Root component body.
 *
 * @param props The props every popup Root shares (read lazily).
 * @param createStore Builds the store exactly once, from the state the props describe and the
 *   default popup id.
 * @param options What differs between popup Roots.
 */
export function createPopupRoot<Store extends PopupRootStore>(
  props: PopupRootProps<any>,
  createStore: (initialState: PopupRootInitialState, defaultPopupId: string | undefined) => Store,
  options: CreatePopupRootOptions = {},
): CreatePopupRootReturnValue<Store> {
  const defaultPopupId = createBaseUiId();
  return createPopupRootWithPopupId(props, createStore, defaultPopupId(), options);
}

/**
 * `createPopupRoot` for a Root that supplies its own default popup id.
 */
export function createPopupRootWithPopupId<Store extends PopupRootStore>(
  props: PopupRootProps<any>,
  createStore: (initialState: PopupRootInitialState, defaultPopupId: string | undefined) => Store,
  defaultPopupId: string | undefined,
  options: CreatePopupRootOptions = {},
): CreatePopupRootReturnValue<Store> {
  const { closeOnActiveTriggerUnmount = false, animateInitialOpen = false } = options;
  const disabled = () => options.disabled?.() ?? false;

  // `default*` props are initial values by contract: read once.
  const store = createStore(
    {
      open: untrack(() => props.defaultOpen) ?? false,
      activeTriggerId: untrack(() => props.defaultTriggerId) ?? null,
    },
    defaultPopupId,
  );

  store.context.nested = useFloatingParentNodeId() != null;
  store.bind('openProp', () => props.open);
  store.bind('triggerIdProp', () => props.triggerId);
  // Callbacks are read when called, which can happen in an effect's apply phase.
  store.context.onOpenChange = (open: boolean, details: any) =>
    untrack(() => props.onOpenChange)?.(open, details);
  store.context.onOpenChangeComplete = (open: boolean) =>
    untrack(() => props.onOpenChangeComplete)?.(open);

  const open = () => !disabled() && store.select('open');

  createImplicitActiveTrigger(store, { closeOnActiveTriggerUnmount });

  const { forceUnmount, transitionStatus, mounted } = createOpenStateTransitions(
    open,
    store,
    () => props.open,
    animateInitialOpen,
  );

  const actions: PopupRootActions = {
    unmount: forceUnmount,
    close: () => store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction)),
  };
  createActionsRef(() => props.actionsRef, actions);
  // Make the actions available to a ref object before the first effects run.
  const initialActionsRef = untrack(() => props.actionsRef);
  if (initialActionsRef && typeof initialActionsRef === 'object') {
    initialActionsRef.current = actions;
  }

  return { store, open, mounted, transitionStatus, forceUnmount };
}

/**
 * Children of a popup Root: elements, or a function receiving the payload of the active trigger.
 * The function is called once; `payload` is a live getter.
 */
export type PayloadChildRenderFunction<Payload> = (arg: {
  readonly payload: Payload | undefined;
}) => JSX.Element;

/**
 * The subset of a popup handle that a Root needs to bind its store to.
 */
export interface PopupRootStoreHandle<Store> {
  attachStore(store: Store): () => void;
}

/**
 * Attaches a Root's store to a handle for the lifetime of the current owner. Called in the Root
 * body, before its children render, so triggers inside the Root see the attached store right away.
 *
 * Pass the handle itself to read it once, or an accessor to follow it: the initial handle is
 * attached right away, and when the accessor returns another handle (or none) the store moves to
 * it, keeping the Root's state (upstream re-attaches the same store when the `handle` prop
 * changes).
 */
export function attachPopupHandle<Store>(
  handle: PopupRootStoreHandle<Store> | undefined | Accessor<PopupRootStoreHandle<Store> | undefined>,
  store: Store,
) {
  if (typeof handle !== 'function') {
    if (handle) {
      onCleanup(handle.attachStore(store));
    }
    return;
  }

  let current = untrack(handle);
  let detach = current?.attachStore(store);
  createEffect(handle, (next) => {
    if (next !== current) {
      detach?.();
      current = next;
      detach = next?.attachStore(store);
    }
  });
  onCleanup(() => {
    detach?.();
    detach = undefined;
  });
}

/**
 * Renders the children of a popup Root, calling a function child with a live `{ payload }`.
 */
export function renderPopupRootChildren<Payload>(
  children: JSX.Element | PayloadChildRenderFunction<Payload> | undefined,
  payload: Accessor<Payload | undefined>,
): JSX.Element {
  if (typeof children === 'function' && children.length > 0) {
    return untrack(() =>
      (children as PayloadChildRenderFunction<Payload>)({
        get payload() {
          return payload();
        },
      }),
    );
  }
  return children as JSX.Element;
}

/**
 * Keeps trigger registration state synchronized while the popup is open.
 *
 * When a popup opens without an explicit trigger id and exactly one trigger is registered, that
 * trigger is claimed as the active trigger, unless the open request deliberately carried no trigger
 * (`openedWithoutTrigger`). When the active trigger id is still registered but its element changed,
 * the active element is refreshed. When the active trigger id is missing from the registry but the
 * same element is still registered under a different id, the active id is reassociated.
 *
 * If `closeOnActiveTriggerUnmount` is enabled, unregistering a previously resolved active trigger
 * requests a close after a microtask so a same-tick replacement trigger with the same id can
 * register first.
 */
export function createImplicitActiveTrigger<State extends PopupStoreState<unknown>>(
  store: PopupTriggerDataStore<State> & {
    setOpen(open: boolean, eventDetails: BaseUIChangeEventDetails<typeof REASONS.none>): void;
  },
  options: { closeOnActiveTriggerUnmount?: boolean | undefined } = {},
) {
  const { closeOnActiveTriggerUnmount = false } = options;
  // Distinguishes a trigger that unmounted from a new active trigger that has not mounted yet.
  let resolvedActiveTriggerId: string | null = null;

  createEffect(
    () =>
      [
        store.select('open'),
        store.select('triggerCount'),
        store.select('activeTriggerId'),
        store.select('activeTriggerElement'),
      ] as const,
    ([open]) => {
      if (!open) {
        resolvedActiveTriggerId = null;
        const reset: Partial<PopupStoreState<unknown>> = {};
        if (store.state.triggerCount !== 0) {
          reset.triggerCount = 0;
        }
        if (store.state.openedWithoutTrigger) {
          reset.openedWithoutTrigger = false;
        }
        if (Object.keys(reset).length > 0) {
          store.update(reset as Partial<State>);
        }
        return;
      }

      const triggerElements = store.context.triggerElements;
      const triggerCount = triggerElements.size;
      const stateUpdates: Partial<PopupStoreState<unknown>> = {};

      if (store.state.triggerCount !== triggerCount) {
        stateUpdates.triggerCount = triggerCount;
      }

      const currentActiveTriggerId = store.state.triggerIdProp ?? store.state.activeTriggerId;
      let lostActiveTriggerId: string | null = null;

      if (currentActiveTriggerId) {
        const activeTriggerElement = triggerElements.getById(currentActiveTriggerId);
        if (!activeTriggerElement) {
          for (const [triggerId, triggerElement] of triggerElements.entries()) {
            if (triggerElement === store.state.activeTriggerElement) {
              stateUpdates.activeTriggerId = triggerId;
              stateUpdates.activeTriggerElement = triggerElement;
              resolvedActiveTriggerId = triggerId;
              break;
            }
          }

          if (stateUpdates.activeTriggerId === undefined) {
            if (resolvedActiveTriggerId === currentActiveTriggerId) {
              lostActiveTriggerId = currentActiveTriggerId;
            } else {
              resolvedActiveTriggerId = null;
            }
          }
        } else {
          resolvedActiveTriggerId = currentActiveTriggerId;
          if (activeTriggerElement !== store.state.activeTriggerElement) {
            stateUpdates.activeTriggerElement = activeTriggerElement;
          }
        }
      } else {
        resolvedActiveTriggerId = null;
      }

      if (
        !lostActiveTriggerId &&
        !currentActiveTriggerId &&
        !store.state.openedWithoutTrigger &&
        triggerCount === 1
      ) {
        const iteratorResult = triggerElements.entries().next();
        if (!iteratorResult.done) {
          const [implicitTriggerId, implicitTriggerElement] = iteratorResult.value;
          stateUpdates.activeTriggerId = implicitTriggerId;
          stateUpdates.activeTriggerElement = implicitTriggerElement;
          resolvedActiveTriggerId = implicitTriggerId;
        }
      }

      if (Object.keys(stateUpdates).length > 0) {
        store.update(stateUpdates as Partial<State>);
      }

      if (lostActiveTriggerId && closeOnActiveTriggerUnmount) {
        const lostId = lostActiveTriggerId;
        // Defer so a same-tick replacement trigger with the same id can register first.
        queueMicrotask(() => {
          const isOpen = store.state.openProp ?? store.state.open;
          const activeId = store.state.triggerIdProp ?? store.state.activeTriggerId;
          if (isOpen && activeId === lostId && !store.context.triggerElements.getById(lostId)) {
            const eventDetails = createChangeEventDetails(REASONS.none);
            store.setOpen(false, eventDetails);
            if (!eventDetails.isCanceled) {
              store.update({
                activeTriggerId: null,
                activeTriggerElement: null,
              } as Partial<State>);
            }
          }
        });
      }
    },
  );
}

/**
 * Manages the mounted state of the popup: binds `mounted` and `transitionStatus` into the store
 * and unmounts the popup once its closing animation finished.
 */
function createOpenStateTransitions<State extends PopupStoreState<unknown>>(
  open: Accessor<boolean>,
  store: ReactiveStore<State, PopupStoreContext<any>, PopupStoreSelectors> & {
    resetOnUnmount(): void;
  },
  openProp: Accessor<boolean | undefined>,
  animateInitialOpen: boolean,
) {
  // In controlled mode, `state.open` holds the last open-change request instead of the open state,
  // and a close through the prop doesn't reset it. Clear it when the prop closes the popup, so
  // `true` on unmount means a request made since then.
  createEffect(openProp, (value) => {
    if (value === false) {
      store.set('open', false);
    }
  });

  const { mounted, transitionStatus, forceUnmount } = createUnmountAfterClose({
    open,
    element: () => store.select('popupElement'),
    preventUnmountOnClose: () => store.select('preventUnmountingOnClose'),
    setPreventUnmountOnClose: (value) => store.set('preventUnmountingOnClose', value),
    animateInitialOpen,
    onUnmount() {
      store.resetOnUnmount();
      store.context.onOpenChangeComplete?.(false);
    },
  });

  store.bind('mounted', mounted);
  store.bind('transitionStatus', transitionStatus);

  return { forceUnmount, transitionStatus, mounted };
}

/**
 * Resets the store's `openMethod` when the popup closes or the Root unmounts.
 */
export function createPopupRootSync<
  State extends PopupStoreState<unknown> & { openMethod: InteractionType | null },
>(store: ReactiveStore<State, any, any>, open: Accessor<boolean>) {
  createEffect(open, (isOpen) => {
    if (!isOpen && store.state.openMethod !== null) {
      store.set('openMethod', null as State['openMethod']);
    }
  });

  onCleanup(() => {
    if (store.state.openMethod !== null) {
      store.set('openMethod', null as State['openMethod']);
    }
  });
}
