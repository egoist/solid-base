import { createEffect, createSignal, onCleanup, untrack, type Accessor } from 'solid-js';
import { EMPTY_OBJECT } from '@egoist/solid-base-utils/empty';
import { FOCUSABLE_ATTRIBUTE } from './constants';
import type { HTMLProps } from '../../internals/types';
import type { InteractionType } from './interactions/enhancedClickHandler';
import type { PopupStoreState, PopupTriggerDataStore } from './store';
import type { PopupInteractionStore } from './types';

/**
 * Props that make a popup element focusable programmatically (and findable by
 * `getFloatingFocusElement`).
 */
export const FOCUSABLE_POPUP_PROPS = {
  tabindex: -1,
  [FOCUSABLE_ATTRIBUTE]: '',
} satisfies HTMLProps<HTMLElement>;

/**
 * Returns the default `initialFocus` resolver for a popup. When opened by touch it focuses the
 * popup element itself to prevent the virtual keyboard from opening (required for Android
 * specifically; iOS handles this automatically). Otherwise it falls back to the default behavior.
 */
export function createDefaultInitialFocus(getPopupElement: () => HTMLElement | null) {
  return (interactionType: InteractionType) =>
    interactionType === 'touch' ? getPopupElement() : true;
}

export interface CreateTriggerDataForwardingReturnValue {
  /**
   * Ref callback for the trigger element.
   */
  registerTrigger: (element: Element | null) => void;
  /**
   * Whether the popup is mounted and was activated by this trigger.
   */
  isMountedByThisTrigger: Accessor<boolean>;
  /**
   * The trigger element (reactive).
   */
  triggerElement: Accessor<Element | null>;
}

/**
 * Registers a trigger element in its popup's store and forwards trigger-owned state (such as the
 * `payload`) to the store while the trigger is the active one.
 *
 * Every argument is an accessor: when the store changes (a handle-backed trigger follows its
 * handle as a Root attaches or detaches) or the id changes, the element migrates from the previous
 * registration to the new one.
 *
 * @param triggerId Id of the trigger.
 * @param store The store the trigger belongs to.
 * @param stateUpdates The state to apply to the store when the trigger is active.
 */
export function createTriggerDataForwarding<State extends PopupStoreState<unknown>>(
  triggerId: Accessor<string | undefined>,
  store: Accessor<PopupTriggerDataStore<State>>,
  stateUpdates: Accessor<Partial<State>> = () => EMPTY_OBJECT as Partial<State>,
): CreateTriggerDataForwardingReturnValue {
  const [triggerElement, setTriggerElement] = createSignal<Element | null>(null, {
    ownedWrite: true,
  });

  const isMountedByThisTrigger = () => store().select('isMountedByTrigger', triggerId()) as boolean;

  // Applies trigger-owned state (active-trigger ownership and payload) when the trigger registers.
  function applyTriggerData(currentStore: PopupTriggerDataStore<State>, id: string | undefined, element: Element) {
    const open = currentStore.state.openProp ?? currentStore.state.open;
    const activeTriggerId = currentStore.state.triggerIdProp ?? currentStore.state.activeTriggerId;
    const updates = untrack(stateUpdates);

    if (activeTriggerId === id) {
      currentStore.update({
        activeTriggerElement: element,
        ...(open ? updates : null),
      } as Partial<State>);
      return;
    }

    if (activeTriggerId == null && open && !currentStore.state.openedWithoutTrigger) {
      // If a popup is already open, a detached trigger can mount before any active trigger
      // has been established. Claim the first registered trigger so trigger-owned focus
      // management and ARIA relationships work.
      currentStore.update({
        activeTriggerId: id ?? null,
        activeTriggerElement: element,
        ...updates,
      } as Partial<State>);
    }
  }

  //
  // Registering the rendered element is what makes the trigger known to the popup, so the state
  // it updates (the registry, the active trigger claimed by a trigger that registers while the
  // popup is open) comes from the element ref rather than from the tracked values: the apply half
  // takes no argument and reads them as of this run.
  createEffect(
    () => {
      store();
      triggerId();
      triggerElement();
    },
    () => {
      const currentStore = untrack(store);
      const id = untrack(triggerId);
      const element = untrack(triggerElement);
      if (element == null || id === undefined) {
        return undefined;
      }
      const triggers = currentStore.context.triggerElements;
      triggers.add(id, element);
      applyTriggerData(currentStore, id, element);
      return () => {
        if (triggers.getById(id) === element) {
          triggers.delete(id);
        }
      };
    },
  );

  createEffect(
    () => {
      const updates = stateUpdates();
      // Read every value so a change re-applies them.
      Object.values(updates);
      return [isMountedByThisTrigger(), store(), updates] as const;
    },
    ([mountedByThisTrigger, currentStore, updates]) => {
      if (mountedByThisTrigger) {
        currentStore.update({
          activeTriggerElement: untrack(triggerElement),
          ...updates,
        } as Partial<State>);
      }
    },
  );

  return {
    registerTrigger: (element) => setTriggerElement(() => element),
    isMountedByThisTrigger,
    triggerElement,
  };
}

/**
 * Publishes the props of a Root's interactions (dismiss handlers etc.) to its store, so detached
 * triggers and the popup can read them. The props objects are live (getters), so they are
 * published once and reset when the owner is disposed.
 */
export function createPopupInteractionProps<State extends PopupStoreState<unknown>>(
  store: PopupTriggerDataStore<State>,
  props: Pick<State, 'activeTriggerProps' | 'inactiveTriggerProps' | 'popupProps'>,
) {
  store.update(props as Partial<State>);
  onCleanup(() => {
    store.update({
      activeTriggerProps: EMPTY_OBJECT,
      inactiveTriggerProps: EMPTY_OBJECT,
      popupProps: EMPTY_OBJECT,
    } as Partial<State>);
  });
}

/**
 * A live props source that forwards every read to the object `accessor` returns, so the props a
 * store publishes (`popupProps`, `triggerProps`…) can go in a `renderElement` props array and stay
 * current when the store replaces them. Reads are tracked.
 */
const EMPTY_PROPS: HTMLProps = Object.freeze({});

export function createDynamicPropsSource(accessor: () => HTMLProps | null | undefined): HTMLProps {
  const EMPTY_OBJECT: HTMLProps = EMPTY_PROPS;
  return new Proxy(Object.create(null) as HTMLProps, {
    get: (_target, key) => (accessor() ?? EMPTY_OBJECT)[key as string],
    has: (_target, key) => key in (accessor() ?? EMPTY_OBJECT),
    ownKeys: () => Reflect.ownKeys(accessor() ?? EMPTY_OBJECT),
    getOwnPropertyDescriptor(_target, key) {
      const source = accessor() ?? EMPTY_OBJECT;
      if (!(key in source)) {
        return undefined;
      }
      return {
        configurable: true,
        enumerable: true,
        get: () => (accessor() ?? EMPTY_OBJECT)[key as string],
      };
    },
  });
}

/**
 * A `PopupInteractionStore` that forwards to whichever store `accessor` returns. Detached triggers
 * use it with their handle's store, which switches when a Root attaches or detaches, so the
 * interactions created once keep reaching the current store.
 */
export function createStoreProxy<Store extends PopupInteractionStore>(
  accessor: () => Store,
): PopupInteractionStore {
  return {
    select: ((key: any, ...args: any[]) => (accessor().select as any)(key, ...args)) as any,
    // Writes and the (non-reactive) context are imperative: resolve the store untracked, so they
    // can be used anywhere, including component bodies.
    set: ((key: any, value: any) => (untrack(accessor) as any).set(key, value)) as any,
    setOpen: (open, details) => untrack(accessor).setOpen(open, details),
    get context() {
      return untrack(accessor).context;
    },
  };
}
