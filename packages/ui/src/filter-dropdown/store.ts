import { NOOP } from '@egoist/solid-base-utils/empty';
import { ReactiveStore } from '../utils/popups/reactiveStore';

export type State = {
  /** The items matching the query, or `null` while nothing filters them. */
  visibleItemIds: ReadonlySet<symbol> | null;
  /**
   * The items the last filtering pass considered. An item registered since then hasn't been
   * matched yet and stays rendered, so its text can be read.
   */
  checkedItemIds: ReadonlySet<symbol> | null;
  registeredItemCount: number;
};

export const selectors = {
  // A null `visibleItemIds` means no query, so fall back to whether anything registered.
  isEmpty: (state: State) =>
    state.visibleItemIds === null
      ? state.registeredItemCount === 0
      : state.visibleItemIds.size === 0,
  isItemVisible: (state: State, id: symbol) =>
    state.visibleItemIds === null ||
    state.visibleItemIds.has(id) ||
    !(state.checkedItemIds?.has(id) ?? false),
};

export class FilterDropdownStore extends ReactiveStore<State, object, typeof selectors> {
  constructor() {
    super({ visibleItemIds: null, checkedItemIds: null, registeredItemCount: 0 }, {}, selectors);
  }
}

let detachedOwner: { registerItem: () => () => void; store: FilterDropdownStore } | undefined;

/**
 * Stand-in for an item whose owning dropdown is absent, such as a filterable submenu's trigger
 * inside a plain parent menu. Nothing registers and every item stays visible.
 */
export function getDetachedOwner() {
  detachedOwner ??= { registerItem: () => NOOP, store: new FilterDropdownStore() };
  return detachedOwner;
}
