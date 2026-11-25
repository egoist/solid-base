import { createContext, useContext } from 'solid-js';
import type { ComboboxStore } from '../store';

/**
 * The items derived by the root. A live object: its getters are reactive.
 */
export interface ComboboxDerivedItemsContext {
  readonly hasItems: boolean;
  readonly filteredItems: any[];
  /**
   * `filteredItems` flattened across groups and projected to selection values. Identical to the
   * items themselves unless `items` is a `createItems()` collection.
   */
  readonly flatFilteredValues: any[];
}

export const ComboboxRootContext = createContext<ComboboxStore | null>(null);
export const ComboboxDerivedItemsContext = createContext<ComboboxDerivedItemsContext | null>(null);

export function useComboboxRootContext(): ComboboxStore;
export function useComboboxRootContext(optional: true): ComboboxStore | null;
export function useComboboxRootContext(optional?: boolean) {
  const context = useContext(ComboboxRootContext);
  if (!context && !optional) {
    throw new Error(
      'Base UI: ComboboxRootContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    );
  }
  return context;
}

export function useComboboxDerivedItemsContext() {
  const context = useContext(ComboboxDerivedItemsContext);
  if (!context) {
    throw new Error(
      'Base UI: ComboboxItemsContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    );
  }
  return context;
}

/**
 * Returns an accessor for the input value of the closest combobox.
 */
export function useComboboxInputValueContext() {
  const store = useComboboxRootContext();
  return () => store.select('inputValue');
}

/**
 * Returns an accessor for whether the closest combobox has an `items` prop.
 */
export function useComboboxHasItemsContext() {
  const items = useContext(ComboboxDerivedItemsContext);
  return () => items?.hasItems ?? false;
}
