import { createSignal, getObserver } from 'solid-js';
import { isDev } from '@solidjs/web';

/**
 * Development-only reverse index of element to registered id, keyed by the owning map.
 *
 * Registration would otherwise have to scan every entry to detect an element claimed by two ids,
 * making the mount of many triggers sharing one handle quadratic. Kept module-scoped, lazily
 * initialized, and read only from `process.env.NODE_ENV` guards so production builds drop it along
 * with the checks.
 */
let devElementIdsByMap: WeakMap<PopupTriggerMap, WeakMap<Element, string>> | undefined;

function getDevElementIds(map: PopupTriggerMap) {
  devElementIdsByMap ??= new WeakMap();

  let elementIds = devElementIdsByMap.get(map);
  if (!elementIds) {
    elementIds = new WeakMap();
    devElementIdsByMap.set(map, elementIds);
  }
  return elementIds;
}

/**
 * Data structure to keep track of popup trigger elements by their IDs.
 *
 * Element lookups iterate the id map rather than maintaining a parallel Set. Registration is O(1),
 * while `hasElement` and `hasMatchingElement` are linear in the number of triggers.
 */
export class PopupTriggerMap {
  private idMap: Map<string, Element> = new Map();

  // Bumped whenever a trigger registers or unregisters, so derived state (the trigger count, the
  // implicit active trigger) follows the registry instead of being copied into the store.
  private readonly changes = createSignal(0, {
    ownedWrite: true,
    equals: false,
    name: 'PopupTriggerMap.changes',
  });

  private changed() {
    this.changes[1]((version) => version + 1);
  }

  /**
   * Inside a reactive scope, subscribes it to every registration change. A no-op elsewhere, so the
   * other (untracked) reads can be used from handlers and effect callbacks.
   */
  public track() {
    if (getObserver()) {
      this.changes[0]();
    }
  }

  /**
   * Adds a trigger element with the given ID.
   *
   * Note: The provided element is assumed to not be registered under multiple IDs.
   */
  public add(id: string, element: Element) {
    if (isDev) {
      const elementIds = getDevElementIds(this);

      const existingId = elementIds.get(element);
      if (existingId !== undefined && existingId !== id) {
        
        
        throw new Error(
          'Base UI: A trigger element cannot be registered under multiple IDs in PopupTriggerMap.',
        );
      }

      // Reusing an id for a different element evicts the previous one, so it must lose its claim
      // on the id or a later registration under a different id would be reported as a duplicate.
      const previousElement = this.idMap.get(id);
      if (previousElement !== undefined && previousElement !== element) {
        elementIds.delete(previousElement);
      }

      elementIds.set(element, id);
    }

    if (this.idMap.get(id) !== element) {
      this.idMap.set(id, element);
      this.changed();
    }
  }

  /**
   * Removes the trigger element with the given ID.
   */
  public delete(id: string) {
    if (isDev) {
      const element = this.idMap.get(id);
      if (element !== undefined) {
        devElementIdsByMap?.get(this)?.delete(element);
      }
    }

    if (this.idMap.delete(id)) {
      this.changed();
    }
  }

  /**
   * Whether the given element is registered as a trigger.
   */
  public hasElement(element: Element): boolean {
    for (const registered of this.idMap.values()) {
      if (registered === element) {
        return true;
      }
    }

    return false;
  }

  /**
   * Whether there is a registered trigger element matching the given predicate.
   */
  public hasMatchingElement(predicate: (el: Element) => boolean): boolean {
    for (const element of this.idMap.values()) {
      if (predicate(element)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Returns the trigger element associated with the given ID, or undefined if no such element exists.
   */
  public getById(id: string): Element | undefined {
    return this.idMap.get(id);
  }

  /**
   * Returns an iterable of all registered trigger entries, where each entry is a tuple of [id, element].
   */
  public entries(): IterableIterator<[string, Element]> {
    return this.idMap.entries();
  }

  /**
   * Returns an iterable of all registered trigger elements.
   */
  public elements(): IterableIterator<Element> {
    return this.idMap.values();
  }

  /**
   * Returns the number of registered trigger elements.
   */
  public get size(): number {
    return this.idMap.size;
  }
}
