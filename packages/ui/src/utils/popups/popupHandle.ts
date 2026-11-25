import { createSignal, getObserver, untrack, type Accessor, type Setter } from 'solid-js';
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
 * A root's claim on a handle: the root's store is attached to whichever handle `handle` returns.
 */
interface HandleAttachment {
  readonly store: unknown;
  readonly handle: Accessor<unknown>;
}

// Every root attached to a handle, in attach order. A root follows its `handle` prop through its
// accessor, so the handle a store is attached to is derived (in the same flush as the prop)
// instead of being moved by an effect. The list is current as soon as a root attaches (a root
// attaches in its body, before its children read it); the signal, created on first use, makes
// reads in reactive scopes follow it.
const attachments: HandleAttachment[] = [];
let attachmentsChanged: [Accessor<number>, Setter<number>] | undefined;

function getAttachmentsChanged() {
  attachmentsChanged ??= createSignal(0, {
    ownedWrite: true,
    equals: false,
    name: 'popupHandle.attachments',
  });
  return attachmentsChanged;
}

function readAttachments(): readonly HandleAttachment[] {
  if (getObserver()) {
    getAttachmentsChanged()[0]();
  }
  return attachments;
}

/**
 * Attaches `store` to the handle `handle` returns, until the returned function is called.
 * @internal
 */
export function attachStoreToHandle(store: unknown, handle: Accessor<unknown>): () => void {
  const attachment: HandleAttachment = { store, handle };
  attachments.push(attachment);
  getAttachmentsChanged()[1](0);
  return () => {
    const index = attachments.indexOf(attachment);
    if (index !== -1) {
      attachments.splice(index, 1);
      getAttachmentsChanged()[1](0);
    }
  };
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

  /**
   * Stores of every root currently using this handle, in attach order. Roots can transiently
   * overlap (e.g. during an animated route transition): the most recently attached one is used.
   * Tracked in reactive scopes.
   */
  private attachedStores(): Store[] {
    const read = () =>
      readAttachments()
        .filter((attachment) => attachment.handle() === this)
        .map((attachment) => attachment.store as Store);
    return getObserver() ? read() : untrack(read);
  }

  protected get attachedStore(): Store | null {
    const stores = untrack(() => this.attachedStores());
    return stores[stores.length - 1] ?? null;
  }

  /**
   * Store that detached triggers read from: the attached root's store, or an inert fallback store
   * used while no root is attached. Tracked in reactive scopes.
   * @internal
   */
  get store(): HandleStore {
    const stores = this.attachedStores();
    return stores[stores.length - 1] ?? this.fallbackStore;
  }

  /**
   * Points the handle at a root's store, so detached triggers re-register into it. Returns a
   * cleanup function that detaches the store again.
   * @internal
   */
  attachStore(newStore: Store) {
    const detach = attachStoreToHandle(newStore, () => this);
    this.warnOnOverlap();
    return detach;
  }

  /**
   * Warns in development when more than one mounted root uses this handle.
   * @internal
   */
  warnOnOverlap() {
    if (!isDev || this.attachedStores().length <= 1) {
      return;
    }
    // Defer the check by a frame and only warn if the overlap is still present.
    (this.overlapWarningFrame ??= AnimationFrame.create()).request(() => {
      if (this.attachedStores().length > 1) {
        console.warn(
          'Base UI: A handle is attached to more than one mounted root at the same time. ' +
            'The most recently mounted root takes over and the previous one stops being controlled by the handle. ' +
            'A handle should be used by a single root that stays mounted for the lifetime of the handle.',
        );
      }
    });
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
      const attachedStores = this.attachedStores();
      for (let i = attachedStores.length - 1; i >= 0 && !triggerElement; i -= 1) {
        triggerElement = attachedStores[i].context.triggerElements.getById(triggerId);
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
