import { createMemo, createSignal, untrack, type Accessor } from 'solid-js';
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
 * host owns list navigation; this root clears the highlight through `setActiveIndex` when the query
 * is edited, and resolves where the filtering pass and item list changes move it, which the host
 * shows through `connectActiveIndex`.
 *
 * `listRef`, `getActiveIndex`, `setActiveIndex`, `connectActiveIndex` and `focusOwnerRef` are read
 * once.
 *
 * @internal
 */
export function FilterDropdownRoot(props: FilterDropdownRoot.Props): JSX.Element {
  const parentItemContext = useFilterDropdownItemContext(true);

  const listRef = untrack(() => props.listRef);
  const getActiveIndex = untrack(() => props.getActiveIndex);
  const setActiveIndex = untrack(() => props.setActiveIndex);
  const connectActiveIndex = untrack(() => props.connectActiveIndex);
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

  // The filtering pass: matches the registered items against the committed query, because a
  // controlled consumer can reject a proposed change. It runs again when the registry changes, and
  // reports how the result moves the highlight.
  const filterPass = createMemo<FilterPass>(
    (previous = INITIAL_FILTER_PASS) => {
      const open = props.open;
      const queryDefined = props.query !== undefined;
      const query = filterQuery();
      registryVersion();
      const match = matchItem();
      const autoHighlightOn = autoHighlightEnabled();

      if (!open && !queryDefined) {
        return previous;
      }

      const queryChanged = previous.query !== null && previous.query !== query;

      // With no query or external filtering, every registered item is visible. External
      // filtering still follows `autoHighlight`; otherwise the item set invalidates the highlight.
      if (match === null) {
        let highlight: HighlightRequest | undefined;
        if (autoHighlightOn && liveItems.size > 0) {
          // Registry updates, such as an item's text changing, keep the current highlight.
          highlight = { index: 0, onlyIfNone: !queryChanged };
        } else if (query === '' && queryChanged) {
          highlight = { index: null };
        }
        return nextFilterPass(previous, {
          query,
          visibleItemIds: null,
          checkedItemIds: null,
          highlight,
        });
      }

      const currentIds = previous.visibleItemIds;
      // The popup's content mounts after the root opens. Publishing an empty result before
      // anything registered would hide every item as it arrives and remount the matches.
      if (currentIds === null && liveItems.size === 0) {
        return nextFilterPass(previous, { ...previous, query, highlight: undefined });
      }

      const nextIds = new Set<symbol>();
      let hasNewMatch = currentIds === null;
      liveItems.forEach(({ getText }, id) => {
        const text = getText();
        if (text != null && match(text, query)) {
          nextIds.add(id);
          hasNewMatch ||= !currentIds?.has(id);
        }
      });
      const checkedItemIds = sameIds(previous.checkedItemIds, liveItems)
        ? previous.checkedItemIds
        : new Set(liveItems.keys());

      // New matches or a smaller result set invalidate the previous item identities.
      if (hasNewMatch || currentIds?.size !== nextIds.size) {
        let highlight: HighlightRequest | undefined;
        // The first filtered result has no prior result identity to invalidate, unless the
        // controlled query itself changed.
        if (autoHighlightOn && nextIds.size > 0) {
          highlight = { index: 0 };
        } else if (currentIds !== null || queryChanged) {
          highlight = { index: null };
        }
        return nextFilterPass(previous, {
          query,
          visibleItemIds: nextIds,
          checkedItemIds,
          highlight,
        });
      }

      return nextFilterPass(previous, {
        query,
        visibleItemIds: currentIds,
        checkedItemIds,
        highlight: autoHighlightOn && queryChanged && nextIds.size > 0 ? { index: 0 } : undefined,
      });
    },
    { name: 'FilterDropdownRoot.filterPass' },
  );

  store.bind('visibleItemIds', () => filterPass().visibleItemIds);
  store.bind('checkedItemIds', () => filterPass().checkedItemIds);

  // The host's DOM-ordered item list, registered by the list part.
  const [itemList, setItemList] = createSignal<
    Accessor<readonly (HTMLElement | null)[]> | undefined
  >(undefined, { ownedWrite: true, name: 'FilterDropdownRoot.itemList' });

  let registeredItemList: Accessor<readonly (HTMLElement | null)[]> | undefined;

  function registerItemList(items: Accessor<readonly (HTMLElement | null)[]>) {
    registeredItemList = items;
    setItemList(() => items);
    return () => {
      if (registeredItemList === items) {
        registeredItemList = undefined;
        setItemList(undefined);
      }
    };
  }

  // Counts the host's highlight writes, including writes of the index it already stores, which a
  // resolved highlight that differs from the stored one must give way to. `writeCount` is current
  // right after a write; the signal tells the resolution below on the next flush.
  let writeCount = 0;
  const [activeIndexWrite, setActiveIndexWrite] = createSignal(0, {
    ownedWrite: true,
    name: 'FilterDropdownRoot.activeIndexWrite',
  });

  // Resolves the highlight from the host's stored index and the events that move it: a filtering
  // pass that places or clears it, and a change of the item list that leaves another item at the
  // highlighted index. The result overrides the stored index until the host writes it again.
  const highlightResolution = createMemo<HighlightResolution>(
    (previous) => {
      const pass = filterPass();
      const items = itemList()?.();
      const write = activeIndexWrite();
      const stored = getActiveIndex();

      let override =
        previous?.override != null &&
        previous.override.write === write &&
        previous.override.stored === stored
          ? previous.override
          : null;
      let current = override ? override.index : stored;

      function moveTo(index: number | null) {
        if (index !== current) {
          current = index;
          override = index === stored ? null : { index, stored, write };
        }
      }

      if (pass !== previous?.pass && pass.highlight) {
        if (!pass.highlight.onlyIfNone || current == null) {
          moveTo(pass.highlight.index);
        }
      }

      const previousItems = previous?.items;
      const itemsChanged = items !== undefined && !sameItems(items, previousItems);
      if (itemsChanged && previousItems) {
        // A positional highlight must not silently move to another item. A change that leaves the
        // highlighted item in place keeps it, such as an item appended after it or one that
        // renders once before the query filters it out.
        if (current == null || items[current] == null || items[current] !== previousItems[current]) {
          moveTo(autoHighlightEnabled() && items.length > 0 ? 0 : null);
        }
      }

      const nextItems = itemsChanged ? items : previousItems;
      return previous &&
        previous.pass === pass &&
        previous.items === nextItems &&
        previous.override === override
        ? previous
        : { pass, items: nextItems, override };
    },
    { name: 'FilterDropdownRoot.highlightResolution' },
  );

  const highlightOverride = createMemo(() => highlightResolution().override, {
    name: 'FilterDropdownRoot.highlightOverride',
  });

  connectActiveIndex?.({
    resolve(stored) {
      const override = highlightOverride();
      return override !== null && override.write === writeCount && override.stored === stored
        ? override.index
        : stored;
    },
    written() {
      writeCount += 1;
      setActiveIndexWrite(writeCount);
    },
  });

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
    registerItemList,
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
   * Reads the index the host stores as highlighted. Read once; called in reactive scopes, so it
   * should track the stored index.
   */
  getActiveIndex: () => number | null;
  /**
   * Moves the host's highlight. Read once.
   */
  setActiveIndex: (index: number | null) => void;
  /**
   * Hands the host the highlight this root resolves: the host shows `resolve(storedIndex)` as its
   * highlighted index, and calls `written()` after each write to its highlight. Without it, the
   * filtering pass doesn't move the host's highlight. Read once.
   */
  connectActiveIndex?: ((connection: FilterDropdownActiveIndexConnection) => void) | undefined;
  /**
   * The host's ref for the input, which holds real focus while the list is navigated virtually.
   * Read once.
   */
  focusOwnerRef?: RefObject<HTMLElement | null> | undefined;
}

export interface FilterDropdownActiveIndexConnection {
  /** Maps the host's stored highlighted index to the index it should show. Tracks what it reads. */
  resolve: (stored: number | null) => number | null;
  /** Reports a write to the host's highlight, even one that stores the index it already holds. */
  written: () => void;
}

interface HighlightRequest {
  index: number | null;
  /** Places the highlight only when nothing is highlighted. */
  onlyIfNone?: boolean | undefined;
}

interface FilterPass {
  /** The query the pass matched, `null` before the first pass. */
  query: string | null;
  visibleItemIds: ReadonlySet<symbol> | null;
  checkedItemIds: ReadonlySet<symbol> | null;
  /** How this pass moves the highlight. */
  highlight: HighlightRequest | undefined;
}

interface HighlightOverride {
  index: number | null;
  /** The stored index this overrides. */
  stored: number | null;
  /** The host write it follows. */
  write: number;
}

interface HighlightResolution {
  pass: FilterPass;
  items: readonly (HTMLElement | null)[] | undefined;
  override: HighlightOverride | null;
}

const INITIAL_FILTER_PASS: FilterPass = {
  query: null,
  visibleItemIds: null,
  checkedItemIds: null,
  highlight: undefined,
};

// A pass that changes nothing keeps the previous result, so its readers don't re-run.
function nextFilterPass(previous: FilterPass, next: FilterPass): FilterPass {
  return next.highlight === undefined &&
    next.query === previous.query &&
    next.visibleItemIds === previous.visibleItemIds &&
    next.checkedItemIds === previous.checkedItemIds
    ? previous
    : next;
}

function sameIds(ids: ReadonlySet<symbol> | null, items: ReadonlyMap<symbol, unknown>) {
  if (ids === null || ids.size !== items.size) {
    return false;
  }
  for (const id of items.keys()) {
    if (!ids.has(id)) {
      return false;
    }
  }
  return true;
}

function sameItems(
  a: readonly (HTMLElement | null)[],
  b: readonly (HTMLElement | null)[] | undefined,
) {
  return b !== undefined && a.length === b.length && a.every((item, index) => item === b[index]);
}

export namespace FilterDropdownRoot {
  export type Props = FilterDropdownRootProps;
  export type ChangeEventReason = FilterDropdownRootNamespace.ChangeEventReason;
  export type ChangeEventDetails = FilterDropdownRootNamespace.ChangeEventDetails;
}
