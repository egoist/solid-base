import { createCollatorItemFilter, createSingleSelectionCollatorFilter } from './index';
import { getFilter } from '../../../internals/filter';
import type { Filter, GetFilterParameters as UseFilterOptions } from '../../../internals/filter';

export type { Filter, UseFilterOptions };

/**
 * Matches items against a query using `Intl.Collator` for robust string matching.
 * The options are read when the filter is created.
 */
export const useCoreFilter = getFilter;

export interface UseComboboxFilterOptions extends UseFilterOptions {
  /**
   * Whether the combobox is in multiple selection mode.
   * @default false
   */
  multiple?: boolean | undefined;
  /**
   * The current value of the combobox, used to keep every item visible while the query still
   * matches the selection.
   */
  value?: any;
}

/**
 * Matches items against a query using `Intl.Collator` for robust string matching.
 *
 * Unlike upstream's hook, the options are read lazily: pass getters for reactive values
 * (`useFilter({ get value() { return value(); } })`) and the returned filter always uses the
 * current ones.
 */
export function useComboboxFilter(options: UseComboboxFilterOptions = {}): Filter {
  function getCoreFilter() {
    const { multiple: _multiple, value: _value, ...collatorOptions } = options;
    return getFilter(collatorOptions);
  }

  const contains: Filter['contains'] = (
    item: any,
    query: string,
    itemToString?: (item: any) => string,
  ) => {
    const coreFilter = getCoreFilter();
    if (options.multiple ?? false) {
      return createCollatorItemFilter(coreFilter, itemToString)(item, query);
    }
    return createSingleSelectionCollatorFilter(
      coreFilter,
      itemToString,
      options.value,
    )(item, query);
  };

  return {
    contains,
    startsWith: (...args) => getCoreFilter().startsWith(...args),
    endsWith: (...args) => getCoreFilter().endsWith(...args),
  };
}
