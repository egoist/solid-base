import { createEffect, createMemo, createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { getFilter } from '../../internals/filter';
import { createBaseUiId } from '../../internals/baseUiId';
import {
  FilterDropdownRootContext,
  FilterDropdownItemContext,
  useFilterDropdownItemContext,
} from './FilterDropdownRootContext';
import type {
  FilterDropdownItemRegistration,
  FilterDropdownFilter,
  FilterDropdownRoot as FilterDropdownRootNamespace,
} from './FilterDropdownRootContext';
import { FilterDropdownStore } from '../store';

/**
 * Holds the filter query, matches it against the registered items, and publishes the result. The
 * host owns list navigation; this root moves the highlight through `setActiveIndex`.
 *
 * `listRef`, `getActiveIndex`, `setActiveIndex` and `focusOwnerRef` are read once.
 *
 * @internal
 */
export function FilterDropdownRoot(props: FilterDropdownRoot.Props): JSX.Element {
  const parentItemContext = useFilterDropdownItemContext(true);

  const listRef = untrack(() => props.listRef);
  const getActiveIndex = untrack(() => props.getActiveIndex);
  const setActiveIndex = untrack(() => props.setActiveIndex);
  const focusOwnerRef: RefObject<HTMLElement | null> = untrack(() => props.focusOwnerRef) ?? {
    current: null,
  };

  const [renderedListId, setRenderedListId] = createSignal<string | undefined>(undefined);
  // Both reset when the host reports a new `openedByKeyboard`.
  const [inputFocusVisible, setInputFocusVisible] = createSignal(
    () => props.openedByKeyboard ?? false,
  );
  const [keyboardModality, setKeyboardModality] = createSignal(
    () => props.openedByKeyboard ?? false,
  );

  const store = new FilterDropdownStore();
  const liveItems = new Map<symbol, FilterDropdownItemRegistration>();
  // Bumped whenever the registry changes, so the filtering pass runs again.
  const [registryVersion, setRegistryVersion] = createSignal(0);

  // The count is published as items register, so a `Menu.Empty` mounting alongside the items
  // never reads a stale zero.
  function registerItem(id: symbol, item: FilterDropdownItemRegistration) {
    liveItems.set(id, item);
    store.set('registeredItemCount', liveItems.size);
    setRegistryVersion((version) => version + 1);
    return () => {
      if (liveItems.get(id) !== item) {
        return;
      }
      liveItems.delete(id);
      store.set('registeredItemCount', liveItems.size);
      setRegistryVersion((version) => version + 1);
    };
  }

  const defaultId = createBaseUiId()();
  const defaultListId = `${defaultId}-list`;

  let lastFilterQuery: string | null = null;

  const autoHighlight = () => props.autoHighlight ?? false;
  const value = () => props.query ?? props.value;
  const filterQuery = () => value().trim();
  // An unused inline filter must not re-run auto-highlighting.
  const matchItem = createMemo((): FilterDropdownFilter | null => {
    const filter = props.filter;
    if (filterQuery() === '' || filter === null) {
      return null;
    }
    return filter ?? getFilter({ locale: props.locale }).contains;
  });
  const autoHighlightEnabled = () =>
    props.open && (autoHighlight() === 'always' || (autoHighlight() !== false && filterQuery() !== ''));

  function handleValueChange(
    nextValue: string,
    eventDetails: FilterDropdownRootNamespace.ChangeEventDetails,
  ) {
    props.onValueChange?.(nextValue, eventDetails);
    // Indexes are positional, so a kept highlight would land on whatever fills its slot.
    // With `autoHighlight`, the filtering pass places the highlight instead.
    if (!eventDetails.isCanceled && !autoHighlight()) {
      setActiveIndex(null);
    }
  }

  function handleItemsChange(previousItems: readonly (HTMLElement | null)[]) {
    const items = listRef.current;
    const activeIndex = getActiveIndex();

    // A positional highlight must not silently move to another item. A change that leaves the
    // highlighted item in place keeps it, such as an item appended after it or one that renders
    // once before the query filters it out. A query change already reset the highlight.
    if (
      activeIndex != null &&
      items[activeIndex] != null &&
      items[activeIndex] === previousItems[activeIndex]
    ) {
      return;
    }

    setActiveIndex(untrack(autoHighlightEnabled) && items.length > 0 ? 0 : null);
  }

  // Re-runs when the registry changes and on the committed query, because a controlled consumer
  // can reject a proposed change.
  createEffect(
    () => ({
      open: props.open,
      queryDefined: props.query !== undefined,
      filterQuery: filterQuery(),
      version: registryVersion(),
      matchItem: matchItem(),
      autoHighlightEnabled: autoHighlightEnabled(),
    }),
    (current) => {
      if (!current.open && !current.queryDefined) {
        return;
      }

      const query = current.filterQuery;
      const queryChanged = lastFilterQuery !== null && lastFilterQuery !== query;
      lastFilterQuery = query;

      // With no query or external filtering, every registered item is visible. External
      // filtering still follows `autoHighlight`; otherwise the item set invalidates the highlight.
      if (current.matchItem === null) {
        store.update({ visibleItemIds: null, checkedItemIds: null });
        // Registry updates, such as an item's text changing, keep the current highlight.
        if (current.autoHighlightEnabled && liveItems.size > 0) {
          if (queryChanged || getActiveIndex() == null) {
            setActiveIndex(0);
          }
        } else if (query === '' && queryChanged) {
          setActiveIndex(null);
        }
        return;
      }

      const currentIds = store.state.visibleItemIds;
      // The popup's content mounts after the root opens. Publishing an empty result before
      // anything registered would hide every item as it arrives and remount the matches.
      if (currentIds === null && liveItems.size === 0) {
        return;
      }

      const matchItem = current.matchItem;
      const nextIds = new Set<symbol>();
      let hasNewMatch = currentIds === null;
      liveItems.forEach(({ getText }, id) => {
        const text = getText();
        if (text != null && matchItem(text, query)) {
          nextIds.add(id);
          hasNewMatch ||= !currentIds?.has(id);
        }
      });
      const checkedItemIds = new Set(liveItems.keys());

      // New matches or a smaller result set invalidate the previous item identities.
      if (hasNewMatch || currentIds?.size !== nextIds.size) {
        // The first filtered result has no prior result identity to invalidate, unless the
        // controlled query itself changed.
        if (current.autoHighlightEnabled && nextIds.size > 0) {
          setActiveIndex(0);
        } else if (currentIds !== null || queryChanged) {
          setActiveIndex(null);
        }
        store.update({ visibleItemIds: nextIds, checkedItemIds });
      } else {
        if (current.autoHighlightEnabled && queryChanged && nextIds.size > 0) {
          setActiveIndex(0);
        }
        store.set('checkedItemIds', checkedItemIds);
      }
    },
  );

  const context: FilterDropdownRootContext = {
    get open() {
      return props.open;
    },
    get disabled() {
      return props.disabled ?? false;
    },
    get value() {
      return value();
    },
    get inputFocusVisible() {
      return inputFocusVisible();
    },
    setInputFocusVisible(visible) {
      setInputFocusVisible(visible);
    },
    get keyboardModality() {
      return keyboardModality();
    },
    setKeyboardModality(next) {
      setKeyboardModality(next);
    },
    get autoHighlight() {
      return autoHighlight();
    },
    // The host owns the trigger. `null` and `''` both mean no element carries an id to point at.
    get triggerId() {
      return props.triggerId || undefined;
    },
    defaultListId,
    get listId() {
      return (renderedListId() ?? defaultListId) || undefined;
    },
    setRenderedListId(id) {
      setRenderedListId(id);
    },
    focusOwnerRef,
    setActiveIndex,
    onItemsChange: handleItemsChange,
    onValueChange: handleValueChange,
  };

  const itemContext: FilterDropdownItemContext = {
    parent: parentItemContext,
    store,
    registerItem,
    listRef,
  };

  return (
    <FilterDropdownItemContext value={itemContext}>
      <FilterDropdownRootContext value={context}>{props.children}</FilterDropdownRootContext>
    </FilterDropdownItemContext>
  );
}

export interface FilterDropdownRootProps {
  children?: JSX.Element;
  /**
   * Whether the popup is currently open.
   */
  open: boolean;
  /** Whether the filter controls should be disabled. */
  disabled?: boolean | undefined;
  /** Whether the popup opened from the keyboard, so the input starts with its focus ring. */
  openedByKeyboard?: boolean | undefined;
  /**
   * Locale used for filtering comparisons.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The filter input value.
   */
  value: string;
  /**
   * Query used for filtering when it differs from the input value, such as while closing.
   */
  query?: string | undefined;
  /**
   * Event handler called when the filter input value changes.
   */
  onValueChange?:
    | ((value: string, eventDetails: FilterDropdownRootNamespace.ChangeEventDetails) => void)
    | undefined;
  /**
   * Custom filter logic used when filtering items. Pass `null` to turn filtering off.
   */
  filter?: FilterDropdownFilter | null | undefined;
  /** Whether the first matching item should be highlighted automatically. */
  autoHighlight?: boolean | 'always' | undefined;
  /**
   * ID of a trigger rendered outside this root, which cannot register itself through the context.
   */
  triggerId?: string | null | undefined;
  /**
   * The host's DOM-ordered list of item elements. Read once.
   */
  listRef: RefObject<Array<HTMLElement | null>>;
  /**
   * Reads the host's highlighted index. Read once.
   */
  getActiveIndex: () => number | null;
  /**
   * Moves the host's highlight. Read once.
   */
  setActiveIndex: (index: number | null) => void;
  /**
   * The host's ref for the input, which holds real focus while the list is navigated virtually.
   * Read once.
   */
  focusOwnerRef?: RefObject<HTMLElement | null> | undefined;
}

export namespace FilterDropdownRoot {
  export type Props = FilterDropdownRootProps;
  export type ChangeEventReason = FilterDropdownRootNamespace.ChangeEventReason;
  export type ChangeEventDetails = FilterDropdownRootNamespace.ChangeEventDetails;
}
