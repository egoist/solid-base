import { createEffect, onCleanup, untrack, type Accessor } from 'solid-js';
import { useFilterDropdownItemContext } from '../root/FilterDropdownRootContext';
import type { FilterDropdownItemContext } from '../root/FilterDropdownRootContext';
import { useFilterDropdownGroupContext } from '../group/FilterDropdownGroupContext';
import { getDetachedOwner } from '../store';

/**
 * Parameters of `createFilterDropdownItem`. Read lazily (pass getters for reactive values), except
 * `context`, which is read once.
 */
export interface CreateFilterDropdownItemParameters {
  /**
   * A text representation of the item used for filtering. Falls back to the rendered text.
   */
  readonly label?: string | undefined;
  /**
   * Keeps the nearest group visible while this filtered-out item must remain mounted.
   */
  readonly retainGroup?: boolean | undefined;
  /**
   * The dropdown that owns this item, when it isn't the nearest one. A filterable submenu's
   * trigger sits inside its own submenu's root but belongs to the enclosing list. Read once.
   */
  readonly context?: FilterDropdownItemContext | null | undefined;
}

export interface CreateFilterDropdownItemReturnValue {
  /**
   * Whether the item matches the current query and should render.
   */
  visible: Accessor<boolean>;
  /**
   * Ref for the rendered element, used to read its text when no `label` is given.
   */
  ref: (element: HTMLElement) => void;
}

/**
 * Registers an item with the enclosing filter root and reports whether the query keeps it.
 *
 * Unlike upstream, the item never reads its `children` (reading them in Solid creates them):
 * without a `label`, its text is the rendered element's `textContent`, cached for when the query
 * filters the item out and unmounts it. An item the filter hasn't matched yet stays rendered so
 * its text can be read: a popup can open with a query that already excludes the item, and a
 * hidden item has no text left to match against. While mounted, text changes made by
 * descendants re-run the query.
 *
 * @internal
 */
export function createFilterDropdownItem(
  params: CreateFilterDropdownItemParameters,
): CreateFilterDropdownItemReturnValue {
  const explicitContext = untrack(() => params.context);
  const nearestContext = useFilterDropdownItemContext(explicitContext !== undefined);
  const groupContext = useFilterDropdownGroupContext();

  const owner = explicitContext === undefined ? nearestContext : explicitContext;
  const { registerItem, store } = owner ?? getDetachedOwner();

  const itemId = Symbol('filter-dropdown-item');
  let element: HTMLElement | null = null;
  let cachedText: string | undefined;
  let unregister: (() => void) | undefined;
  let observer: MutationObserver | undefined;

  const label = () => params.label;

  function readText() {
    const currentLabel = untrack(label);
    if (currentLabel != null) {
      return currentLabel;
    }
    // A mounted item reports what it renders now, even nothing, since a descendant can change its
    // text. A filtered-out item falls back to the cached text.
    if (element?.isConnected) {
      cachedText = element.textContent ?? '';
    }
    return cachedText;
  }

  function register() {
    unregister?.();
    unregister = registerItem(itemId, { getText: readText });
  }

  // (Re-)register when the label changes, so the active query runs again.
  createEffect(label, () => {
    if (element) {
      const text = element.textContent ?? '';
      if (text) {
        cachedText = text;
      }
    }
    register();
  });

  onCleanup(() => {
    observer?.disconnect();
    unregister?.();
    unregister = undefined;
  });

  if (groupContext) {
    createEffect(
      () => params.retainGroup ?? false,
      (retained) => groupContext.registerItem(itemId, retained),
    );
  }

  function observe(node: HTMLElement) {
    observer?.disconnect();
    if (typeof MutationObserver === 'undefined') {
      return;
    }
    observer = new MutationObserver(() => {
      if (element !== node || !node.isConnected || untrack(label) != null) {
        return;
      }
      const text = node.textContent ?? '';
      if (text !== cachedText) {
        cachedText = text;
        // Re-register so the active query runs again against the new text.
        register();
      }
    });
    observer.observe(node, { characterData: true, childList: true, subtree: true });
  }

  return {
    visible: () => store.select('isItemVisible', itemId),
    ref(node) {
      element = node;
      // The element's children are already created, so its text is known before it's attached.
      const text = node.textContent ?? '';
      if (text) {
        cachedText = text;
      }
      observe(node);
    },
  };
}
