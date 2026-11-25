import { createEffect, createMemo, createSignal, type Accessor } from 'solid-js';
import { useFilterDropdownItemContext } from '../root/FilterDropdownRootContext';
import type { FilterDropdownGroupContext } from './FilterDropdownGroupContext';
import { useFilterDropdownGroupContext } from './FilterDropdownGroupContext';

export interface CreateFilterDropdownGroupReturnValue {
  /**
   * Whether the query filtered out every item in the group, so its label doesn't linger over an
   * empty section.
   */
  hidden: Accessor<boolean>;
  /**
   * Provider value that collects the group's items.
   */
  context: FilterDropdownGroupContext;
}

/**
 * Tracks which items belong to a group and hides the group once none of them match.
 *
 * @internal
 */
export function createFilterDropdownGroup(): CreateFilterDropdownGroupReturnValue {
  const { store } = useFilterDropdownItemContext();
  const parentContext = useFilterDropdownGroupContext();

  const items = new Map<symbol, boolean>();
  const [version, setVersion] = createSignal(0);

  function registerItem(id: symbol, retained: boolean) {
    items.set(id, retained);
    setVersion((v) => v + 1);
    return () => {
      if (items.get(id) === retained && items.delete(id)) {
        setVersion((v) => v + 1);
      }
    };
  }

  const hidden = createMemo(() => {
    version();
    const visibleItemIds = store.select('visibleItemIds');
    // A group with no members hasn't been filtered out, it hasn't registered yet.
    if (visibleItemIds === null || items.size === 0) {
      return false;
    }
    for (const [id, retained] of items) {
      if (retained || visibleItemIds.has(id)) {
        return false;
      }
    }
    return true;
  });

  // A nested container collects its own items, so the enclosing one only ever sees this
  // registration. Report visibility upward or a group of groups would look empty.
  if (parentContext) {
    const groupId = Symbol('filter-dropdown-group');
    createEffect(hidden, (isHidden) => parentContext.registerItem(groupId, !isHidden));
  }

  return { hidden, context: { registerItem } };
}
