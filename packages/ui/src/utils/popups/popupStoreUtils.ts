import { createEffect, createMemo, createSignal, onCleanup, untrack, type Accessor } from 'solid-js';
import { EMPTY_OBJECT } from '@egoist/solid-base-utils/empty';
import { FOCUSABLE_ATTRIBUTE } from './constants';
import type { HTMLProps } from '../../internals/types';
import type { InteractionType } from './interactions/enhancedClickHandler';
import type { PopupStoreState, PopupTriggerDataStore } from './store';
import type { PopupTriggerMap } from './popupTriggerMap';
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
 * The state each trigger element supplies to its popup while it is the active trigger (see
 * `deriveActiveTriggerState`).
 */
const triggerStates = new WeakMap<Element, object>();

/**
 * Registers the state the trigger rendered as `element` supplies to its popup while it is the
 * active trigger: an object whose getters are read when the popup reads that state. Call it from
 * the trigger's ref, before the element registers with the popup.
 */
export function registerTriggerState(element: Element, state: object) {
  triggerStates.set(element, state);
}

export interface DeriveActiveTriggerStateOptions<Key> {
  /**
   * Keys that read `undefined` while the popup is mounted without an active trigger, instead of
   * the stored value.
   */
  clearWithoutTrigger?: readonly Key[] | undefined;
}

/**
 * Derives `keys` from the state the active trigger supplies (`registerTriggerState`), in the same
 * flush as the active trigger changes, instead of having the trigger write them once it became
 * active. Like that forwarding, the state outlives the trigger's activation until another trigger
 * becomes active. A popup mounted without an active trigger reads the stored values (written by
 * `handle.open()` and the like).
 *
 * Call it in the Root body. The derivations are removed when the owner is disposed.
 */
export function deriveActiveTriggerState<Key extends string>(
  store: {
    derive(key: Key, fn: (stored: any) => any): () => void;
    select(key: 'activeTriggerId' | 'mounted'): any;
    readonly context: { readonly triggerElements: PopupTriggerMap };
  },
  keys: readonly Key[],
  options: DeriveActiveTriggerStateOptions<Key> = {},
) {
  const triggers = store.context.triggerElements;
  // `null` while the popup is mounted without an active trigger.
  const activeTriggerState = createMemo<object | null | undefined>(
    (previous) => {
      const activeTriggerId = store.select('activeTriggerId') as string | null;
      if (activeTriggerId == null) {
        return store.select('mounted') ? null : previous;
      }
      triggers.track();
      const element = triggers.getById(activeTriggerId);
      return (element && triggerStates.get(element)) || previous;
    },
    { name: 'deriveActiveTriggerState.activeTriggerState' },
  );

  const removers = keys.map((key) => {
    const clearWithoutTrigger = options.clearWithoutTrigger?.includes(key) ?? false;
    return store.derive(key, (stored) => {
      const state = activeTriggerState();
      if (state === null && clearWithoutTrigger) {
        return undefined;
      }
      return state ? (state as Record<string, unknown>)[key] : stored;
    });
  });
  onCleanup(() => removers.forEach((remove) => remove()));
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
