import { createSignal, type Accessor, type Setter } from 'solid-js';
import { isDev } from '@solidjs/web';
import { AnimationFrame } from '@egoist/solid-base-utils/animationFrame';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { PopupTriggerMap } from './popupTriggerMap';

/**
 * Minimal store contract exposed by popup handles to detached triggers.
 *
 * @template HandleStore Store shape exposed to detached triggers.
 */
export interface PopupHandleStoreProvider<HandleStore> {
  /**
   * Store currently exposed by the handle. Reading it inside a reactive scope tracks it, so
   * detached triggers follow the handle as a Root attaches or detaches.
   */
  readonly store: HandleStore;
}

/**
 * Store shape holding a trigger registry.
 */
export interface PopupHandleStoreWithTriggers {
  readonly context: { readonly triggerElements: PopupTriggerMap };
}

/**
 * Store shape required by `BasePopupHandle.openByTrigger`/`closePopup` to drive open/close state.
 */
export interface PopupHandleStoreWithOpen extends PopupHandleStoreWithTriggers {
  setOpen(
    open: boolean,
    eventDetails: BaseUIChangeEventDetails<typeof REASONS.imperativeAction>,
  ): void;
}

/**
 * Shared implementation for popup handles that coordinate detached triggers with a mounted root.
 *
 * Subclasses provide the component-specific imperative methods, while this base class owns the
 * fallback store, the root store attachment stack, the reactive store pointer and the development
 * warning for overlapping roots.
 *
 * Handles are created outside components (`Dialog.createHandle()`); the store pointer is a signal
 * created on first use.
 *
 * @template HandleStore Store shape exposed to detached triggers.
 * @template Store Root-owned store attached by the component root.
 */
export class BasePopupHandle<
  HandleStore extends PopupHandleStoreWithTriggers,
  Store extends HandleStore & PopupHandleStoreWithOpen,
> implements PopupHandleStoreProvider<HandleStore> {
  /**
   * Stores of every root currently using this handle, in attach order. Roots can transiently
   * overlap (e.g. during an animated route transition), so this stack lets the cleanup of
   * `attachStore` restore the previous root.
   */
  private readonly attachedStores: Store[] = [];

  private attachedStoreValue: Store | null = null;

  private versionSignal: [Accessor<number>, Setter<number>] | undefined;

  private version = 0;

  private overlapWarningFrame: AnimationFrame | undefined;

  /**
   * @param fallbackStore Inert, closed store handed to detached triggers while no root is attached.
   * @param componentName Component name used to prefix dev warnings.
   * @param throwOnMissingTrigger Whether `open(triggerId)` throws when no trigger with that id is
   * registered. Anchored popups need a trigger to anchor to, so they throw; Dialog is not anchored
   * and instead opens unassociated with a dev warning.
   */
  constructor(
    protected readonly fallbackStore: HandleStore,
    private readonly componentName: string,
    private readonly throwOnMissingTrigger: boolean = true,
  ) {}

  protected get attachedStore() {
    return this.attachedStoreValue;
  }

  /**
   * Store that detached triggers read from: the attached root's store, or an inert fallback store
   * used while no root is attached. Tracked in reactive scopes.
   * @internal
   */
  get store(): HandleStore {
    this.getVersionSignal()[0]();
    return this.attachedStoreValue ?? this.fallbackStore;
  }

  /**
   * Points the handle at a root's store and notifies detached triggers so they re-register into it.
   * Returns a cleanup function that detaches the store again.
   * @internal
   */
  attachStore(newStore: Store) {
    this.attachedStores.push(newStore);
    this.setActiveStore(newStore);

    if (isDev && this.attachedStores.length > 1) {
      // Defer the check by a frame and only warn if the overlap is still present.
      (this.overlapWarningFrame ??= AnimationFrame.create()).request(() => {
        if (this.attachedStores.length > 1) {
          console.warn(
            'Base UI: A handle is attached to more than one mounted root at the same time. ' +
              'The most recently mounted root takes over and the previous one stops being controlled by the handle. ' +
              'A handle should be used by a single root that stays mounted for the lifetime of the handle.',
          );
        }
      });
    }

    return () => {
      const index = this.attachedStores.lastIndexOf(newStore);
      if (index !== -1) {
        this.attachedStores.splice(index, 1);
      }
      this.setActiveStore(this.attachedStores[this.attachedStores.length - 1] ?? null);
    };
  }

  private getVersionSignal() {
    this.versionSignal ??= createSignal(0, { ownedWrite: true });
    return this.versionSignal;
  }

  private setActiveStore(store: Store | null) {
    if (this.attachedStoreValue !== store) {
      this.attachedStoreValue = store;
      this.version += 1;
      this.getVersionSignal()[1](this.version);
    }
  }

  /**
   * Opens the attached root's store and associates it with the trigger with the given id, or a
   * no-op (with a dev warning) while no root is attached.
   *
   * This method should only be called in an event handler or an effect.
   *
   * @param triggerId ID of the trigger to associate with the popup, or `null`/`undefined` to open
   * without associating any trigger.
   */
  protected openByTrigger(triggerId: string | null | undefined) {
    const attachedStore = this.attachedStore;

    if (attachedStore === null) {
      if (isDev) {
        console.warn(
          `Base UI: ${this.componentName}Handle.open() was called while no root using this handle is mounted. ` +
            'The call was ignored; mount a root with this handle before opening it imperatively.',
        );
      }
      return;
    }

    // A detached trigger may still be registered in the fallback store or a previously attached
    // root's store, so search all of them.
    let triggerElement: Element | undefined;
    if (triggerId) {
      for (let i = this.attachedStores.length - 1; i >= 0 && !triggerElement; i -= 1) {
        triggerElement = this.attachedStores[i].context.triggerElements.getById(triggerId);
      }
      triggerElement ??= this.fallbackStore.context.triggerElements.getById(triggerId);
    }

    if (triggerId && !triggerElement) {
      if (this.throwOnMissingTrigger) {
        throw new Error(
          `Base UI: ${this.componentName}Handle.open() was called with the trigger id "${triggerId}", ` +
            'but no matching trigger is registered with this handle. ' +
            'An anchored popup cannot open without a trigger to anchor to. ' +
            `Pass the id of a mounted ${this.componentName}.Trigger that has this handle set on its "handle" prop.`,
        );
      }

      if (isDev) {
        console.warn(
          `Base UI: ${this.componentName}Handle.open: No trigger found with id "${triggerId}". ` +
            'The popup will open, but the trigger will not be associated with it.',
        );
      }
    }

    attachedStore.setOpen(
      true,
      createChangeEventDetails(REASONS.imperativeAction, undefined, triggerElement),
    );
  }

  /**
   * Closes the popup, or a no-op (with a dev warning) while no root is attached.
   */
  protected closePopup() {
    const attachedStore = this.attachedStore;

    if (attachedStore === null) {
      if (isDev) {
        console.warn(
          `Base UI: ${this.componentName}Handle.close() was called while no root using this handle is mounted. ` +
            'The call was ignored.',
        );
      }
      return;
    }

    attachedStore.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
  }
}
