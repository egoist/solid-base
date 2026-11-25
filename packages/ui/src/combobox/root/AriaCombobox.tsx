import {
  For,
  Show,
  createEffect,
  createMemo,
  getObserver,
  onCleanup,
  runWithOwner,
  untrack,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { getOverflowAncestors } from '@floating-ui/dom';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '@egoist/solid-base-utils/empty';
import { applyRef, type RefProp } from '@egoist/solid-base-utils/refs';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import { activeElement, closest, contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import {
  visuallyHiddenInput,
  visuallyHiddenInputPinned,
} from '@egoist/solid-base-utils/visuallyHidden';
import type { ElementProps } from '../../utils/popups/types';
import { createDismiss } from '../../utils/popups/interactions/dismiss';
import { createPopupRoot } from '../../utils/popups/popupRoot';
import type { ActionsRef } from '../../utils/popups/popupRoot';
import { createInitialPopupStoreState, createPopupStoreContext } from '../../utils/popups/store';
import { createListNavigation } from '../../utils/popups/interactions/listNavigation';
import { createClick } from '../../utils/popups/interactions/click';
import { gridNavigation } from '../../utils/popups/interactions/gridNavigation';
import { createOpenInteractionType } from '../../utils/popups/interactions/openInteractionType';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import type {
  BaseUIChangeEventDetails,
  BaseUIHighlightEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { getHighlightReason } from '../../utils/getHighlightReason';
import { ComboboxDerivedItemsContext, ComboboxRootContext } from './ComboboxRootContext';
import { ComboboxStore, selectors } from '../store';
import type { State as StoreState } from '../store';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups/popupStoreUtils';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { createRegisterFieldControl } from '../../internals/field-register-control/createRegisterFieldControl';
import { useFormContext } from '../../internals/form-context/FormContext';
import { createLabelableId } from '../../internals/labelable-provider/createLabelableId';
import { createCollatorItemFilter } from './utils';
import type { FilterItemToString } from './utils';
import { useCoreFilter } from './utils/useFilter';
import { isScrollableY } from '../../utils/scrollable';
import type { BaseUIEvent, HTMLProps } from '../../internals/types';
import { NOOP } from '../../internals/noop';
import { getHiddenInputType } from '../../internals/getHiddenInputType';
import { mergeProps } from '../../merge-props/mergeProps';
import { renderElement } from '../../internals/renderElement';
import type { Group } from '../../internals/resolveValueLabel';
import {
  stringifyAsLabel,
  stringifyAsValue,
  flattenLeafItems,
  isGroupedItems,
} from '../../internals/resolveValueLabel';
import {
  compareItemEquality,
  defaultItemEquality,
  findItemIndex,
  findSelectionIndex,
  isSelectedValueDirty,
  removeItem,
  selectedValueIncludes,
} from '../../internals/itemEquality';
import { INITIAL_LAST_HIGHLIGHT, NO_ACTIVE_VALUE } from './utils/constants';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import { findCollectionItem } from '../items/itemCollection';
import type { ComboboxItemCollection, ItemCollection } from '../items/itemCollection';

type InternalAriaComboboxProps<Value, Mode extends SelectionMode, Item = Value> = AriaComboboxProps<
  Value,
  Mode,
  Item
> & {
  filterQuery?: string | undefined;
};

/**
 * The combobox behind `Combobox.Root` and `Autocomplete.Root`.
 * Doesn't render its own HTML element (besides the hidden form inputs).
 *
 * @internal
 */
export function AriaCombobox<Value = any, Mode extends SelectionMode = 'none', Item = Value>(
  props: InternalAriaComboboxProps<Value, Mode, Item>,
): JSX.Element {
  const formContext = useFormContext();
  const field = useFieldRootContext();
  const { validation } = field;

  const direction = useDirection();
  const id = createLabelableId({ id: () => props.id });
  const collatorFilter = createMemo(() => useCoreFilter({ locale: props.locale }));

  // --- Props -------------------------------------------------------------------------------

  const selectionMode = (): SelectionMode => props.selectionMode;
  const multiple = () => selectionMode() === 'multiple';
  const single = () => selectionMode() === 'single';
  const disabled = () => (field.disabled() ?? false) || (props.disabled ?? false);
  const name = () => field.name() ?? props.name;
  const readOnly = () => props.readOnly ?? false;
  const required = () => props.required ?? false;
  const grid = () => props.grid ?? false;
  const virtualized = () => props.virtualized ?? false;
  const inlineProp = () => props.inline ?? false;
  const openOnInputClick = () => props.openOnInputClick ?? true;
  const keepHighlight = () => props.keepHighlight ?? false;
  const highlightItemOnHover = () => props.highlightItemOnHover ?? true;
  const loopFocus = () => props.loopFocus ?? true;
  const isItemEqualToValue = () =>
    (props.isItemEqualToValue as ((a: any, b: any) => boolean) | undefined) ?? defaultItemEquality;
  const fillInputOnItemPress = () => props.fillInputOnItemPress ?? true;
  const modal = () => props.modal ?? false;
  const limit = () => props.limit ?? -1;
  const autoComplete = () => props.autoComplete ?? 'list';
  const submitOnItemClick = () => props.submitOnItemClick ?? false;
  const autoHighlightMode = (): false | 'input-change' | 'always' => {
    const autoHighlight = props.autoHighlight ?? false;
    if (autoHighlight === 'always') {
      return 'always';
    }
    return autoHighlight ? 'input-change' : false;
  };

  // `useControlled`: whether a value is controlled is decided once, when the root is created.
  const selectedValueControlled = untrack(() => props.selectedValue !== undefined);
  const inputValueControlled = untrack(() => props.inputValue !== undefined);
  // Read once, like upstream's first render.
  const hasInputValue = untrack(
    () => props.inputValue !== undefined || props.defaultInputValue !== undefined,
  );

  // --- Items -------------------------------------------------------------------------------

  // Plain items are arrays; normalized `createItems()` collections are objects.
  const collection = createMemo(() => {
    const itemsProp = props.items;
    const result = Array.isArray(itemsProp)
      ? null
      : (itemsProp as unknown as ItemCollection<Item, Value> | undefined);

    if (result && typeof result.label !== 'function') {
      throw new Error(
        'Base UI: the `items` prop received an object that is not a collection, ' +
          'so its items cannot be read. Pass an array of items, an array of groups with items, ' +
          'or the result of `createItems()`. ' +
          'See https://base-ui.com/react/components/combobox#createitems',
      );
    }
    return result ?? null;
  });

  const items = () => {
    const currentCollection = collection();
    return (currentCollection ? currentCollection.data : props.items) as
      readonly Item[] | readonly Group<Item>[] | undefined;
  };
  const itemToValue = () => collection()?.value;

  // A projected collection's items live in the source domain, not the selection-value domain the
  // store matches against, so they are withheld from the store.
  const storeItems = () => (itemToValue() ? undefined : items());

  // The externally filtered items projected to their selection values, with a lookup back to the
  // source items.
  const externalWindow = createMemo(() => {
    const filteredItemsProp = props.filteredItems;
    const toValue = itemToValue();
    if (!filteredItemsProp || !toValue) {
      return undefined;
    }
    const flat = flattenLeafItems(filteredItemsProp as readonly any[]);
    const values = flat.map(toValue);
    let valueToItem: Map<any, any> | undefined;

    return {
      values,
      findItem(itemValue: any, isEqual: (item: any, value: any) => boolean) {
        if (!valueToItem) {
          valueToItem = new Map();
          for (let i = 0; i < values.length; i += 1) {
            if (!valueToItem.has(values[i])) {
              valueToItem.set(values[i], flat[i]);
            }
          }
        }

        return findCollectionItem(valueToItem, itemValue, isEqual);
      },
    };
  });

  // Labels selection values from current props only: collection data first, then the current
  // external window, then the prop.
  const itemToStringLabel = createMemo(() => {
    const currentCollection = collection();
    const itemToStringLabelProp = props.itemToStringLabel as ((item: any) => string) | undefined;
    if (!currentCollection) {
      return itemToStringLabelProp;
    }
    const window = externalWindow();
    const isEqual = isItemEqualToValue();
    return (itemValue: Value) => {
      return currentCollection.label(itemValue, isEqual, (unresolvedValue: any) => {
        const externalItem = window?.findItem(unresolvedValue, isEqual);
        if (externalItem != null) {
          return currentCollection.itemLabel(externalItem);
        }
        return stringifyAsLabel(unresolvedValue, itemToStringLabelProp);
      });
    };
  });

  const filterItemToString = createMemo<FilterItemToString | undefined>(() => {
    const currentCollection = collection();
    if (!currentCollection) {
      return props.itemToStringLabel as FilterItemToString | undefined;
    }
    const toStringLabel = itemToStringLabel();
    return Object.assign((item: any) => currentCollection.itemLabel(item), {
      selected: (value: any) => stringifyAsLabel(value, toStringLabel),
    });
  });

  function stringifyValueLabel(item: any) {
    return stringifyAsLabel(item, untrack(itemToStringLabel));
  }

  const filter = createMemo(() => {
    const filterProp = props.filter;
    if (filterProp === null) {
      return () => true;
    }
    if (filterProp !== undefined) {
      return filterProp as (item: any, query: string, itemToString?: any) => boolean;
    }
    // `shouldBypassFiltering` already empties the query whenever a single selection's label
    // matches it exactly, so the filter never needs a selection-aware variant here.
    return createCollatorItemFilter(collatorFilter(), filterItemToString());
  });

  // --- Refs --------------------------------------------------------------------------------

  const listRef = createRefObject<Array<HTMLElement | null>>([]);
  const labelsRef = createRefObject<Array<string | null>>([]);
  const popupRef = createRefObject<HTMLDivElement | null>(null);
  const inputRef = createRefObject<HTMLInputElement | null>(null);
  const startDismissRef = createRefObject<HTMLSpanElement | null>(null);
  const endDismissRef = createRefObject<HTMLSpanElement | null>(null);
  const emptyRef = createRefObject<HTMLDivElement | null>(null);
  const chipsContainerRef = createRefObject<HTMLDivElement | null>(null);
  const clearRef = createRefObject<HTMLButtonElement | null>(null);
  const selectionEventRef = createRefObject<MouseEvent | PointerEvent | KeyboardEvent | null>(null);
  /**
   * Contains the currently visible list of item values post-filtering.
   */
  const valuesRef = createRefObject<any[]>([]);
  /**
   * The item element that received the last `pointerdown`, used to detect whether a
   * `mouseup` on an item belongs to a drag-select gesture that started elsewhere.
   */
  const pointerDownItemRef = createRefObject<Element | null>(null);
  let hiddenInputElement: HTMLInputElement | null = null;
  let hadInputClear = false;
  let lastHighlight = INITIAL_LAST_HIGHLIGHT;
  let pendingQueryHighlight: null | {
    hasQuery: boolean;
    selection?: boolean | undefined;
    // The value a selection-driven clear just added, so the restore can keep it
    // highlighted instead of returning to the open anchor.
    toggledValue?: any;
  } = null;

  // --- Store -------------------------------------------------------------------------------

  const initialSelectedValue = untrack(() => {
    if (selectedValueControlled) {
      return props.selectedValue;
    }
    const defaultSelectedValue = props.defaultSelectedValue ?? null;
    return multiple() ? (defaultSelectedValue ?? EMPTY_ARRAY) : defaultSelectedValue;
  });

  // If neither inputValue nor defaultInputValue are provided, derive it from the
  // selected value for single mode so the input reflects the selection on mount.
  const initialDefaultInputValue = untrack(() => {
    if (hasInputValue) {
      return props.defaultInputValue ?? '';
    }
    if (single()) {
      return stringifyValueLabel(initialSelectedValue);
    }
    return '';
  });

  const rootProps = {
    get open() {
      return readProp(() => props.open);
    },
    get defaultOpen() {
      return props.defaultOpen ?? false;
    },
    // Called with the combobox's own handling around `props.onOpenChange`.
    onOpenChange: (nextOpen: boolean, eventDetails: AriaCombobox.OpenChangeEventDetails) =>
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      handleOpenChange(nextOpen, eventDetails),
    // Called from effects: read the callback untracked.
    onOpenChangeComplete: (open: boolean) => untrack(() => props.onOpenChangeComplete)?.(open),
    get actionsRef() {
      return props.actionsRef as ActionsRef<AriaCombobox.Actions> | undefined;
    },
  };

  const { store, open, transitionStatus } = createPopupRoot(
    rootProps,
    (initialState, defaultPopupId) =>
      untrack(
        () =>
          new ComboboxStore(
            {
              ...createInitialPopupStoreState(defaultPopupId),
              ...initialState,
              id: id(),
              labelId: undefined,
              selectedValue: initialSelectedValue,
              selectedValueState: initialSelectedValue,
              inputValue: initialDefaultInputValue,
              inputValueState: initialDefaultInputValue,
              queryChangedAfterOpen: false,
              closeQuery: null,
              items: storeItems(),
              selectionMode: selectionMode(),
              name: name(),
              form: props.form,
              disabled: disabled(),
              readOnly: readOnly(),
              required: required(),
              grid: grid(),
              virtualized: virtualized(),
              openOnInputClick: openOnInputClick(),
              itemToStringLabel: itemToStringLabel(),
              isItemEqualToValue: isItemEqualToValue(),
              modal: modal(),
              autoHighlight: autoHighlightMode(),
              submitOnItemClick: submitOnItemClick(),
              hasInputValue,
              forceMounted: false,
              inline: inlineProp(),
              activeIndex: null,
              selectedIndex: null,
              listProps: EMPTY_OBJECT as HTMLProps,
              inputProps: EMPTY_OBJECT as HTMLProps,
              itemProps: EMPTY_OBJECT as HTMLProps,
              listElement: null,
              popupElementId: undefined,
              triggerElement: null,
              inputElement: null,
              inputGroupElement: null,
              popupSide: null,
              openMethod: null,
              inputInsidePopup: true,
              // Avoid duplicate names. Popup inputs aren't rendered until the popup mounts, so the
              // hidden input takes over then if needed.
              inputOwnsFormValue: selectionMode() === 'none',
              instantType: undefined,
              adaptiveOrigin: undefined,
            },
            {
              ...createPopupStoreContext(),
              // Assigned below.
              handleUnmount: NOOP,
              setInputValue: NOOP,
              setSelectedValue: NOOP,
              setIndices: NOOP,
              handleSelection: NOOP,
              forceMount: NOOP,
              requestSubmit: NOOP,
              onOpenChangeComplete: undefined,
              listRef,
              labelsRef,
              popupRef,
              emptyRef,
              inputRef,
              startDismissRef,
              endDismissRef,
              chipsContainerRef,
              clearRef,
              valuesRef,
              pointerDownItemRef,
              selectionEventRef,
            },
            selectors,
          ),
      ),
  );

  const rootStore = store;

  // Controlled values are read from the props; uncontrolled ones from the store. Either way,
  // `store.state.selectedValue` / `store.state.inputValue` are the current values.
  store.bind('selectedValue', () =>
    selectedValueControlled
      ? readProp(() => props.selectedValue)
      : rootStore.select('selectedValueState'),
  );
  store.bind('inputValue', () =>
    inputValueControlled ? readProp(() => props.inputValue) : rootStore.select('inputValueState'),
  );

  const selectedValue = () => store.select('selectedValue');
  const inputValue = () => store.select('inputValue');
  const queryChangedAfterOpen = () => rootStore.select('queryChangedAfterOpen');
  const closeQuery = () => rootStore.select('closeQuery');
  const setQueryChangedAfterOpen = (value: boolean) =>
    rootStore.set('queryChangedAfterOpen', value);
  const setCloseQuery = (value: string | null) => rootStore.set('closeQuery', value);

  const hasItems = () => items() !== undefined;
  const hasFilteredItemsProp = () => props.filteredItems !== undefined;

  // --- Derived items -----------------------------------------------------------------------

  const isGrouped = () => isGroupedItems(items());
  const query = () => {
    const currentCloseQuery = closeQuery();
    return !open() && currentCloseQuery !== null
      ? currentCloseQuery
      : String(inputValue() ?? '').trim();
  };

  const selectedLabelString = createMemo(() => {
    if (!single()) {
      return '';
    }
    return stringifyAsLabel(selectedValue(), itemToStringLabel());
  });

  const shouldBypassFiltering = () => {
    const currentQuery = query();
    const label = selectedLabelString();
    return (
      single() &&
      !queryChangedAfterOpen() &&
      currentQuery !== '' &&
      label.length === currentQuery.length &&
      collatorFilter().contains(label, currentQuery)
    );
  };

  const filterQuery = createMemo(() =>
    shouldBypassFiltering() ? '' : (props.filterQuery ?? query()),
  );

  const shouldIgnoreExternalFiltering = () => {
    const currentCollection = collection();
    return (
      hasItems() &&
      hasFilteredItemsProp() &&
      shouldBypassFiltering() &&
      (!currentCollection || currentCollection.hasValue(selectedValue(), isItemEqualToValue()))
    );
  };

  const flatItems = createMemo((): readonly Item[] => {
    const currentItems = items();
    return currentItems ? flattenLeafItems<Item>(currentItems) : EMPTY_ARRAY;
  });

  const filteredItems = createMemo((): Item[] | Group<Item>[] => {
    const filteredItemsProp = props.filteredItems;
    if (filteredItemsProp && !shouldIgnoreExternalFiltering()) {
      return filteredItemsProp as Item[] | Group<Item>[];
    }

    const currentItems = items();
    if (!currentItems) {
      return EMPTY_ARRAY;
    }

    const currentLimit = limit();
    const currentFilterQuery = filterQuery();
    const currentFilter = filter();
    const itemToString = filterItemToString();

    if (isGrouped()) {
      const groupedItems = currentItems as readonly Group<Item>[];
      const resultingGroups: Group<Item>[] = [];
      let currentCount = 0;

      for (const group of groupedItems) {
        if (currentLimit > -1 && currentCount >= currentLimit) {
          break;
        }

        const remainingLimit = currentLimit > -1 ? currentLimit - currentCount : Infinity;
        const itemsToTake =
          currentFilterQuery === '' ? group.items.slice(0, remainingLimit) : ([] as Item[]);

        if (currentFilterQuery !== '') {
          for (const item of group.items) {
            if (itemsToTake.length >= remainingLimit) {
              break;
            }
            if (currentFilter(item, currentFilterQuery, itemToString)) {
              itemsToTake.push(item);
            }
          }
        }

        if (itemsToTake.length > 0) {
          resultingGroups.push({ ...group, items: itemsToTake });
          currentCount += itemsToTake.length;
        }
      }

      return resultingGroups;
    }

    const allItems = flatItems();

    if (currentFilterQuery === '') {
      return currentLimit > -1 ? allItems.slice(0, currentLimit) : (allItems as Item[]);
    }

    const limitedItems: Item[] = [];
    for (const item of allItems) {
      if (currentLimit > -1 && limitedItems.length >= currentLimit) {
        break;
      }
      if (currentFilter(item, currentFilterQuery, itemToString)) {
        limitedItems.push(item);
      }
    }

    return limitedItems;
  });

  /**
   * The filtered items flattened across groups and projected to their selection values.
   */
  const flatFilteredValues = createMemo((): any[] => {
    const currentFilteredItems = filteredItems();
    const window = externalWindow();
    if (window && currentFilteredItems === props.filteredItems) {
      return window.values;
    }
    const flat = flattenLeafItems<Item>(currentFilteredItems as readonly Item[]);
    const toValue = itemToValue();
    return toValue ? flat.map((item) => toValue(item)) : (flat as any[]);
  });

  // An inline list open on the first render never gets a closed pass of the closed-state sync
  // effect below, and `items`-prop lists don't self-register their index the way individually
  // rendered `<Combobox.Item>`s do, so the selected item was never highlighted. Seeding the index
  // here lets list navigation highlight and scroll to the selection on mount.
  untrack(() => {
    if (inlineProp() && open() && hasItems() && selectionMode() !== 'none') {
      store.set(
        'selectedIndex',
        findSelectionIndex(flatFilteredValues(), selectedValue(), isItemEqualToValue(), multiple()),
      );
    }
  });

  const fieldRawValue = () => (selectionMode() === 'none' ? inputValue() : selectedValue());
  const fieldStringValue = () => {
    if (selectionMode() === 'none') {
      return fieldRawValue();
    }
    const value = selectedValue();
    const itemToStringValue = props.itemToStringValue as ((item: any) => string) | undefined;
    if (Array.isArray(value)) {
      return value.map((item) => stringifyAsValue(item, itemToStringValue));
    }
    return stringifyAsValue(value, itemToStringValue);
  };

  const inputInsidePopup = () => store.select('inputInsidePopup');
  const inline = () => store.select('inline');
  const inputMatchesSelectedValue = () =>
    single() && !inputInsidePopup() && inputValue() === selectedLabelString();

  const { openMethod, triggerProps } = createOpenInteractionType(open);

  createRegisterFieldControl({
    controlRef: {
      get current() {
        return store.state.inputInsidePopup
          ? (store.state.triggerElement as HTMLElement | null)
          : inputRef.current;
      },
      set current(_value) {},
    },
    id,
    value: fieldRawValue,
    getValue: () => untrack(fieldStringValue),
    enabled: () => !disabled(),
    name: () => props.name,
  });

  // --- Commands ----------------------------------------------------------------------------

  function forceMount() {
    if (untrack(items)) {
      // Ensure typeahead works on a closed list.
      labelsRef.current = untrack(flatFilteredValues).map(stringifyValueLabel);
    } else {
      store.set('forceMounted', true);
    }
  }

  /**
   * Emits `onItemHighlighted` for the item at `index`, or clears the highlight when `index` is `-1`
   * (a no-op if nothing was highlighted). Keeps `lastHighlight` in sync with what was emitted.
   */
  function emitHighlight(
    value: any,
    index: number,
    type: AriaCombobox.HighlightEventReason,
    event?: Event,
  ) {
    if (index === -1) {
      if (lastHighlight === INITIAL_LAST_HIGHLIGHT) {
        return;
      }
      lastHighlight = INITIAL_LAST_HIGHLIGHT;
    } else {
      lastHighlight = { value, index };
    }

    untrack(() => props.onItemHighlighted)?.(
      value,
      createGenericEventDetails(type, event, {
        index,
      }) as AriaCombobox.HighlightEventDetails,
    );
  }

  function setIndices(options: {
    activeIndex?: number | null | undefined;
    selectedIndex?: number | null | undefined;
    type?: AriaCombobox.HighlightEventReason | undefined;
    event?: Event | undefined;
  }) {
    const update = {} as Pick<StoreState, 'activeIndex' | 'selectedIndex'>;

    if (options.activeIndex !== undefined) {
      update.activeIndex = options.activeIndex;
    }

    if (options.selectedIndex !== undefined) {
      update.selectedIndex = options.selectedIndex;
    }

    store.update(update);

    const activeIndexOption = options.activeIndex;
    if (activeIndexOption === undefined) {
      return;
    }

    const type: AriaCombobox.HighlightEventReason = options.type || REASONS.none;

    if (activeIndexOption === null) {
      emitHighlight(undefined, -1, type, options.event);
    } else {
      emitHighlight(valuesRef.current[activeIndexOption], activeIndexOption, type, options.event);
    }
  }

  function setInputValue(next: string, eventDetails: AriaCombobox.ChangeEventDetails) {
    untrack(() => props.onInputValueChange)?.(next, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    // A canceled selection clear must not suppress close-completion cleanup.
    hadInputClear = eventDetails.reason === REASONS.inputClear;

    const isOpen = untrack(open);

    // If user is typing, ensure we don't auto-highlight on open due to a race
    // with the post-open effect that sets this flag.
    if (eventDetails.reason === REASONS.inputChange) {
      // A controlled popup may ignore a close request. Resuming input proves the popup
      // is remaining open, so release the query captured for an exit animation.
      if (isOpen && store.state.closeQuery !== null) {
        setCloseQuery(null);
      }

      const event = eventDetails.event as Event;
      const inputType = (event as InputEvent).inputType;
      // Treat composition commits as typed input; autofill may omit `inputType` or
      // report `insertReplacementText`.
      const isTypedInput =
        event.type === 'compositionend' ||
        (inputType != null && inputType !== '' && inputType !== 'insertReplacementText');
      if (isTypedInput) {
        const hasQuery = next.trim() !== '';
        if (hasQuery) {
          setQueryChangedAfterOpen(true);
        }
        // Defer index updates until after the filtered items have been derived to ensure
        // `onItemHighlighted` receives the latest item.
        pendingQueryHighlight = { hasQuery };

        // Virtualized lists own their scroller. Reset regular lists directly so a stale
        // composite registry cannot select a reordered item and scrolling cannot escape
        // the popup.
        const list = store.state.listElement;
        if (!store.state.virtualized && list) {
          const popup = popupRef.current;
          for (const ancestor of getOverflowAncestors(list.firstElementChild ?? list)) {
            if (
              !isHTMLElement(ancestor) ||
              (popup ? !contains(popup, ancestor) : ancestor.getAttribute('role') === 'dialog')
            ) {
              break;
            }

            if (isScrollableY(ancestor)) {
              ancestor.scrollTop = 0;
              break;
            }
          }
        }

        if (
          hasQuery &&
          store.state.autoHighlight &&
          store.state.activeIndex == null &&
          (isOpen || store.state.inline)
        ) {
          store.set('activeIndex', 0);
        }
      }
    } else if (
      eventDetails.reason === REASONS.inputClear &&
      next === '' &&
      store.state.inputInsidePopup
    ) {
      // A programmatic clear of an active query (e.g. after selecting an item with the
      // input inside the popup): restore the highlight to the selected item.
      pendingQueryHighlight = { hasQuery: false, selection: true };
    }

    if (!inputValueControlled) {
      rootStore.set('inputValueState', next);
    }
  }

  function handleInterruptedReopen(isInputChange: boolean) {
    const currentInputValue = store.state.inputValue;
    // Preserve values supplied with the reopen rather than owned by the interrupted close.
    const clearsPendingInput =
      !isInputChange &&
      store.state.inputInsidePopup &&
      !store.state.inline &&
      currentInputValue !== '' &&
      (String(currentInputValue).trim() === store.state.closeQuery ||
        currentInputValue === untrack(selectedLabelString));

    // Keep the flag while a visible filter survives so the `items` sync cannot overwrite it.
    if (
      !isInputChange &&
      (clearsPendingInput || currentInputValue === '' || untrack(inputMatchesSelectedValue))
    ) {
      setQueryChangedAfterOpen(false);
    }

    setCloseQuery(null);

    if (clearsPendingInput) {
      // Cleanup clears omit the selection flag and reopening gesture.
      setInputValue('', createChangeEventDetails(REASONS.inputClear));
    }
  }

  // Calls `onOpenChange` for every open change that isn't ignored, with the combobox's own handling
  // around it, before the store commits the change.
  function handleOpenChange(nextOpen: boolean, eventDetails: AriaCombobox.OpenChangeEventDetails) {
    // If the `Empty` component is not used, the positioner or popup should be hidden
    // with CSS. In this case, allow the Escape key to bubble to close a parent popup
    // if there are no items to show.
    if (
      eventDetails.reason === REASONS.escapeKey &&
      untrack(hasItems) &&
      untrack(flatFilteredValues).length === 0 &&
      !emptyRef.current
    ) {
      eventDetails.allowPropagation();
    }

    untrack(() => props.onOpenChange)?.(nextOpen, eventDetails);

    // A typed request must not highlight a later open: discard it when its own open is
    // rejected, or when any other open change goes through.
    if (
      pendingQueryHighlight?.hasQuery &&
      (eventDetails.reason === REASONS.inputChange) === eventDetails.isCanceled
    ) {
      pendingQueryHighlight = null;
    }

    if (eventDetails.isCanceled) {
      return;
    }

    if (nextOpen && store.state.closeQuery !== null) {
      // `ComboboxInput` calls `setInputValue` before `setOpen`, so on an input-change reopen
      // `inputValue` is the post-keystroke value and the typed filter always survives.
      handleInterruptedReopen(eventDetails.reason === REASONS.inputChange);
    }

    const currentQuery = untrack(query);
    const isInline = store.state.inline;
    const isInputInsidePopup = store.state.inputInsidePopup;

    if (!nextOpen && store.state.queryChangedAfterOpen) {
      if (untrack(single)) {
        if (!isInline) {
          setCloseQuery(currentQuery);
        }
        // Avoid a flicker when closing the popup with an empty query.
        if (currentQuery === '') {
          setQueryChangedAfterOpen(false);
        }
      } else if (untrack(multiple)) {
        if (!isInline) {
          // Freeze the current query so filtering remains stable while exiting.
          setCloseQuery(currentQuery);
        }

        if (isInputInsidePopup) {
          setIndices({ activeIndex: null });
        }

        // Clear the input immediately on close while retaining filtering via closeQuery for exit
        // animations if the input is outside the popup. When the input is inside the popup, defer
        // the clear until unmount so the filtered list doesn't flash to unfiltered during the exit
        // animation.
        if (!isInputInsidePopup || isInline) {
          setInputValue(
            '',
            createChangeEventDetails(REASONS.inputClear, eventDetails.event, undefined, {
              isItemPress: eventDetails.reason === REASONS.itemPress,
            }),
          );
        }
      }
    }

    if (
      !nextOpen &&
      isInputInsidePopup &&
      (eventDetails.reason === REASONS.focusOut || eventDetails.reason === REASONS.outsidePress)
    ) {
      field.setTouched(true);
      field.setFocused(false);

      if (untrack(field.validationMode) === 'onBlur') {
        validation.commit(untrack(fieldRawValue));
      }
    }
  }

  function setSelectedValue(nextValue: any, eventDetails: AriaCombobox.ChangeEventDetails) {
    untrack(() => props.onSelectedValueChange)?.(nextValue as any, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    if (!selectedValueControlled) {
      rootStore.set('selectedValueState', nextValue);
    }

    const shouldFillInput =
      (store.state.selectionMode === 'none' && popupRef.current && untrack(fillInputOnItemPress)) ||
      (store.state.selectionMode === 'single' && !store.state.inputInsidePopup);

    if (shouldFillInput) {
      setInputValue(
        stringifyValueLabel(nextValue),
        createChangeEventDetails(eventDetails.reason, eventDetails.event),
      );
    }
  }

  function handleSelection(event: MouseEvent | PointerEvent | KeyboardEvent, itemValue: any) {
    const targetEl = getTarget(event) as HTMLElement | null;
    const overrideEvent = selectionEventRef.current ?? event;
    selectionEventRef.current = null;
    const eventDetails = createChangeEventDetails(REASONS.itemPress, overrideEvent);

    // Let the link handle the click.
    const href = closest(targetEl, 'a')?.getAttribute('href');
    if (href) {
      if (href.startsWith('#')) {
        store.setOpen(false, eventDetails);
      }
      return;
    }

    const comparer = store.state.isItemEqualToValue;

    if (store.state.selectionMode === 'multiple') {
      const currentSelectedValue = Array.isArray(store.state.selectedValue)
        ? store.state.selectedValue
        : [];
      const isCurrentlySelected = selectedValueIncludes(currentSelectedValue, itemValue, comparer);
      const nextValue = isCurrentlySelected
        ? removeItem(currentSelectedValue, itemValue, comparer)
        : [...currentSelectedValue, itemValue];

      setSelectedValue(nextValue, eventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      const wasFiltering = inputRef.current ? inputRef.current.value.trim() !== '' : false;
      if (!wasFiltering) {
        return;
      }

      if (store.state.inputInsidePopup) {
        setInputValue(
          '',
          createChangeEventDetails(REASONS.inputClear, eventDetails.event, undefined, {
            isItemPress: true,
          }),
        );
        // A newly selected item stays highlighted through the clear; a deselection
        // falls back to the standard selection anchor.
        const pendingHighlight = pendingQueryHighlight;
        if (pendingHighlight && !isCurrentlySelected) {
          pendingHighlight.toggledValue = itemValue;
        }
      } else {
        store.setOpen(false, eventDetails);
      }
    } else {
      setSelectedValue(itemValue, eventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      store.setOpen(false, eventDetails);
    }
  }

  function requestSubmit() {
    // Not `validation.inputRef`: outside a Field, every control shares it.
    const formElement = hiddenInputElement?.form ?? store.state.inputElement?.form;
    if (formElement && typeof formElement.requestSubmit === 'function') {
      formElement.requestSubmit();
    }
  }

  function handleUnmount() {
    setQueryChangedAfterOpen(false);
    setCloseQuery(null);

    const mode = store.state.selectionMode;

    if (mode === 'none') {
      setIndices({ activeIndex: null, selectedIndex: null });
    } else {
      setIndices({ activeIndex: null });
    }

    // Multiple selection mode:
    // If the user typed a filter and didn't select in multiple mode, clear the input
    // after close completes to avoid mid-exit flicker and start fresh on next open.
    if (
      mode === 'multiple' &&
      inputRef.current &&
      inputRef.current.value !== '' &&
      !hadInputClear
    ) {
      setInputValue('', createChangeEventDetails(REASONS.inputClear));
    }

    // Single selection mode:
    // - If input is rendered inside the popup, clear it so the next open is blank
    // - If input is outside the popup, sync it to the selected value
    if (mode === 'single') {
      if (store.state.inputInsidePopup) {
        if (inputRef.current && inputRef.current.value !== '') {
          setInputValue('', createChangeEventDetails(REASONS.inputClear));
        }
      } else {
        const stringVal = stringifyValueLabel(store.state.selectedValue);
        if (inputRef.current && inputRef.current.value !== stringVal) {
          // If no selection was made, treat this as clearing the typed filter.
          const reason = stringVal === '' ? REASONS.inputClear : REASONS.none;
          setInputValue(stringVal, createChangeEventDetails(reason));
        }
      }
    }
  }

  Object.assign(store.context, {
    handleUnmount,
    setInputValue,
    setSelectedValue,
    setIndices,
    handleSelection,
    forceMount,
    requestSubmit,
  });

  // Support composing the Dialog component around an inline combobox: the closest
  // `[role="dialog"]` of an inline list is its animated element.
  const resolvedPopupElement = (): HTMLElement | null => {
    const positionerElement = store.select('positionerElement');
    if (inline() && positionerElement) {
      return closest(positionerElement, '[role="dialog"]') as HTMLElement | null;
    }
    return store.select('popupElement');
  };

  // --- Effects -----------------------------------------------------------------------------

  let previousCloseQuery: string | null = null;

  createEffect(
    () => ({
      open: open(),
      closeQuery: closeQuery(),
      selectedValue: selectedValue(),
      selectionMode: selectionMode(),
      multiple: multiple(),
      hasItems: hasItems(),
      flatFilteredValues: flatFilteredValues(),
      isItemEqualToValue: isItemEqualToValue(),
    }),
    (current) => {
      untrack(() => {
        const closeQueryReleased = previousCloseQuery !== null && current.closeQuery === null;
        previousCloseQuery = current.closeQuery;

        // Closing indexes against the frozen filtered list. Reopening releases that query, so
        // its rendered coordinates must be synchronized again even though the popup is already
        // open.
        if (current.open && (!closeQueryReleased || !current.hasItems)) {
          return;
        }

        // State-driven (not tied to the internal event path) so controlled closes
        // also clear a pointerdown that never received a matching item mouseup.
        if (!current.open) {
          pointerDownItemRef.current = null;
        }

        if (current.selectionMode === 'none') {
          return;
        }

        // Without `items`, look the selection up in the live registry of mounted item values.
        // Keep the selected index in the coordinates of the list that is actually rendered.
        const registry: readonly any[] = current.hasItems
          ? current.flatFilteredValues
          : valuesRef.current;

        setIndices({
          selectedIndex: findSelectionIndex(
            registry,
            current.selectedValue,
            current.isItemEqualToValue,
            current.multiple,
          ),
        });
      });
    },
  );

  createEffect(
    () => [hasItems(), flatFilteredValues()] as const,
    ([currentHasItems, values]) => {
      if (currentHasItems) {
        valuesRef.current = values;
        listRef.current.length = values.length;
      }
    },
  );

  createEffect(open, (isOpen) => {
    // Controlled closes can bypass `setOpen`, and their exit animation may be interrupted.
    if (!isOpen && pendingQueryHighlight?.hasQuery) {
      pendingQueryHighlight = null;
    }
  });

  createEffect(
    () => ({
      activeIndex: store.select('activeIndex'),
      autoHighlightMode: autoHighlightMode(),
      hasFilteredItemsProp: hasFilteredItemsProp(),
      hasItems: hasItems(),
      flatFilteredValues: flatFilteredValues(),
      inline: inline(),
      open: open(),
      resolvedPopupElement: resolvedPopupElement(),
      inputValue: inputValue(),
    }),
    (current) => {
      untrack(() => syncHighlight(current));
    },
  );

  function syncHighlight(current: {
    activeIndex: number | null;
    autoHighlightMode: false | 'input-change' | 'always';
    hasFilteredItemsProp: boolean;
    hasItems: boolean;
    flatFilteredValues: any[];
    inline: boolean;
    open: boolean;
    resolvedPopupElement: HTMLElement | null;
    inputValue: any;
  }) {
    const { autoHighlightMode: autoHighlightModeValue, open: isOpen, inline: isInline } = current;

    // A kept-mounted dialog hides its inline list on close. Discard query-clear restoration
    // before it can overwrite the cleared highlight or report an item from the unfiltered list.
    if (!isOpen && isInline && current.resolvedPopupElement) {
      pendingQueryHighlight = null;
      return;
    }

    const candidateItems =
      current.hasItems || current.hasFilteredItemsProp
        ? current.flatFilteredValues
        : valuesRef.current;
    const pendingHighlight = pendingQueryHighlight;
    if (pendingHighlight) {
      // A directly rendered list remains visible when the popup state is closed, while a
      // kept-mounted Positioner is hidden and should stay inert.
      const listIsNavigable = isOpen || isInline || store.state.positionerElement?.hidden === false;
      if (pendingHighlight.hasQuery) {
        const input = inputRef.current;
        // Keep the request while results or a controlled popup opening are pending,
        // but do not restore an inline highlight after focus has left the input.
        if (
          !autoHighlightModeValue ||
          String(current.inputValue).trim() === '' ||
          (isInline &&
            autoHighlightModeValue !== 'always' &&
            (!input || activeElement(input.ownerDocument) !== input))
        ) {
          pendingQueryHighlight = null;
        } else if (
          listIsNavigable &&
          // Individually rendered items register without re-running this effect, and their
          // registry has holes mid-reindex, so resolve their request immediately.
          (candidateItems[0] !== undefined || (!current.hasItems && !current.hasFilteredItemsProp))
        ) {
          store.set('activeIndex', 0);
          pendingQueryHighlight = null;
        }
      } else if (String(current.inputValue).trim() === '') {
        // Only handle the clear once it has committed (a controlled input may reject it),
        // so a restore cannot fire while a query is still active.
        pendingQueryHighlight = null;
        if (listIsNavigable) {
          const clearedBySelection = pendingHighlight.selection;
          if (
            autoHighlightModeValue === 'always' &&
            !clearedBySelection &&
            store.state.selectionMode === 'none'
          ) {
            // There is no selection to restore in Autocomplete. Keep the first-item reset
            // synchronous so list navigation sees it before a directly rendered list closes.
            store.set('activeIndex', 0);
          }

          // Items re-mounted by the clear publish their composite indices in a follow-up
          // microtask, so the item registries are mid-update here. Defer past that.
          queueMicrotask(() => {
            queueMicrotask(() => {
              if (
                (!store.select('open') && (!store.state.inline || current.resolvedPopupElement)) ||
                (inputRef.current && inputRef.current.value.trim() !== '')
              ) {
                return;
              }

              // Return the highlight to the selected item, the same anchor the popup uses
              // when it first opens.
              const currentSelectedValue = store.state.selectedValue;
              const isMultiple = store.state.selectionMode === 'multiple';
              const hasSelection =
                isMultiple && Array.isArray(currentSelectedValue)
                  ? currentSelectedValue.length > 0
                  : store.state.selectionMode !== 'none' && currentSelectedValue != null;

              if (hasSelection) {
                const registry =
                  current.hasItems || current.hasFilteredItemsProp
                    ? untrack(flatFilteredValues)
                    : valuesRef.current;
                // A selection-driven clear keeps the just-selected item highlighted;
                // otherwise return to the open anchor.
                const toggledIndex = findItemIndex(
                  registry,
                  pendingHighlight.toggledValue,
                  store.state.isItemEqualToValue,
                );
                store.set(
                  'activeIndex',
                  toggledIndex !== -1
                    ? toggledIndex
                    : findSelectionIndex(
                        registry,
                        currentSelectedValue,
                        store.state.isItemEqualToValue,
                        isMultiple,
                      ),
                );
              } else if (clearedBySelection) {
                store.set('activeIndex', null);
              } else if (autoHighlightModeValue === 'always') {
                store.set('activeIndex', 0);
              }
            });
          });
        }
      }
    }

    if (!isOpen && !isInline) {
      return;
    }

    const storeActiveIndex = store.state.activeIndex;

    if (storeActiveIndex == null) {
      if (autoHighlightModeValue === 'always' && candidateItems.length > 0) {
        store.set('activeIndex', 0);
        return;
      }
      emitHighlight(undefined, -1, REASONS.none);
      return;
    }

    if (storeActiveIndex >= candidateItems.length) {
      emitHighlight(undefined, -1, REASONS.none);
      store.set('activeIndex', null);
      return;
    }

    const itemValue = candidateItems[storeActiveIndex];
    const previouslyHighlightedItemValue = lastHighlight.value;
    const isSameItem =
      previouslyHighlightedItemValue !== NO_ACTIVE_VALUE &&
      compareItemEquality(
        itemValue,
        previouslyHighlightedItemValue,
        store.state.isItemEqualToValue,
      );

    if (lastHighlight.index !== storeActiveIndex || !isSameItem) {
      emitHighlight(itemValue, storeActiveIndex, REASONS.none);
    }
  }

  createEffect(
    () =>
      selectionMode() === 'none'
        ? String(inputValue() ?? '') !== ''
        : multiple()
          ? Array.isArray(selectedValue()) && selectedValue().length > 0
          : selectedValue() != null,
    (filled) => {
      field.setFilled(filled);
    },
  );

  // Ensures that the active index is not set to 0 when the list is empty.
  // This avoids needing to press ArrowDown twice under certain conditions.
  createEffect(
    () => hasItems() && Boolean(autoHighlightMode()) && flatFilteredValues().length === 0,
    (empty) => {
      if (empty) {
        setIndices({ activeIndex: null });
      }
    },
  );

  // `useValueChanged(query)`: a memo, so the effect only runs when the value changes.
  createEffect(
    createMemo(query),
    (currentQuery) => {
      untrack(() => {
        if (
          open() &&
          currentQuery !== '' &&
          currentQuery !== String(initialDefaultInputValue) &&
          !inputMatchesSelectedValue()
        ) {
          setQueryChangedAfterOpen(true);
        }
      });
    },
    { defer: true },
  );

  // `useValueChanged(open)`: a memo, so the effect only runs when the value changes.
  createEffect(
    createMemo(open),
    (isOpen) => {
      // A controlled `open` prop can interrupt the close without calling `setOpen`.
      if (isOpen && store.state.closeQuery !== null) {
        handleInterruptedReopen(false);
      }
    },
    { defer: true },
  );

  function syncInputToSelectedLabel() {
    const label = untrack(selectedLabelString);
    if (store.state.inputValue !== label) {
      setInputValue(label, createChangeEventDetails(REASONS.none));
    }
  }

  // `useValueChanged(selectedValue)`: a memo, so the effect only runs when the value changes.
  createEffect(
    createMemo(selectedValue),
    (value) => {
      untrack(() => {
        if (selectionMode() === 'none') {
          return;
        }

        formContext.clearErrors(name());
        field.setDirty(
          isSelectedValueDirty(value, field.validityData().initialValue, isItemEqualToValue()),
        );

        validation.change(value);

        if (single() && !hasInputValue && !store.state.inputInsidePopup) {
          syncInputToSelectedLabel();
        }
      });
    },
    { defer: true },
  );

  // The label catches accessor changes while the items identity restores the selected label after
  // a one-step input clear followed by a data reload.
  createEffect(
    () => [selectedLabelString(), items()] as const,
    () => {
      untrack(() => {
        if (
          single() &&
          !hasInputValue &&
          !store.state.inputInsidePopup &&
          !store.state.queryChangedAfterOpen
        ) {
          syncInputToSelectedLabel();
        }
      });
    },
    { defer: true },
  );

  // `useValueChanged(inputValue)`: a memo, so the effect only runs when the value changes.
  createEffect(
    createMemo(inputValue),
    (value) => {
      untrack(() => {
        if (selectionMode() !== 'none') {
          return;
        }

        formContext.clearErrors(name());
        field.setDirty(value !== field.validityData().initialValue);

        validation.change(value);
      });
    },
    { defer: true },
  );

  // --- Interactions ------------------------------------------------------------------------

  const expanded = () => open() || inline();

  const role: ElementProps = {
    reference: {
      get autocomplete() {
        return shouldTreatAsInput() ? 'off' : undefined;
      },
      get spellcheck() {
        return shouldTreatAsInput() ? 'false' : undefined;
      },
      get autocorrect() {
        return shouldTreatAsInput() ? 'off' : undefined;
      },
      get autocapitalize() {
        return shouldTreatAsInput() ? 'none' : undefined;
      },
      get role() {
        return shouldApplyAria() ? 'combobox' : undefined;
      },
      get 'aria-expanded'() {
        return shouldApplyAria() ? (expanded() ? 'true' : 'false') : undefined;
      },
      get 'aria-haspopup'() {
        return shouldApplyAria() ? (grid() ? 'grid' : 'listbox') : undefined;
      },
      get 'aria-controls'() {
        return shouldApplyAria() && expanded()
          ? store.select('listElement')?.id || undefined
          : undefined;
      },
      get 'aria-autocomplete'() {
        // `readOnly` accepts no input, so no completion of any kind is offered.
        return shouldApplyAria() ? (readOnly() ? 'none' : autoComplete()) : undefined;
      },
    } as HTMLProps,
    floating: { role: 'presentation' },
  };

  function shouldTreatAsInput() {
    const inputElement = store.select('inputElement');
    // Before the input mounts, assume an input-like control so combobox ARIA attributes are
    // present.
    return inputElement == null || inputElement.tagName === 'INPUT';
  }

  function shouldApplyAria() {
    // A non-input control only takes on combobox semantics while the list is exposed, which for
    // an inline list is the whole time.
    return shouldTreatAsInput() || expanded();
  }

  // `readOnly` locks the value, not the interaction: the popup opens and can be browsed.
  const click = createClick(store.interactions, {
    get enabled() {
      return !disabled() && openOnInputClick();
    },
    event: 'mousedown-only',
    toggle: false,
    // Apply a small delay for touch to let mobile viewport/keyboard positioning settle.
    get touchOpenDelay() {
      return inputInsidePopup() ? 0 : 100;
    },
    reason: REASONS.inputPress,
  });

  const dismiss = createDismiss(store.interactions, {
    get enabled() {
      return !disabled() && !inline();
    },
    outsidePressEvent: {
      mouse: 'sloppy',
      // The visual viewport (affected by the mobile software keyboard) can be
      // somewhat small. The user may want to scroll the screen to see more of
      // the popup.
      touch: 'intentional',
    },
    // Without a popup, let the Escape key bubble the event up to other popups' handlers.
    get bubbles() {
      return inline() ? true : undefined;
    },
    outsidePress(event) {
      const target = getTarget(event) as Element | null;
      return (
        !contains(store.state.triggerElement, target) &&
        !contains(clearRef.current, target) &&
        !contains(chipsContainerRef.current, target) &&
        !contains(store.state.inputGroupElement, target)
      );
    },
  });

  const listNavigation = createListNavigation(store.interactions, {
    get enabled() {
      return !disabled();
    },
    get id() {
      return id();
    },
    listRef,
    get activeIndex() {
      return store.select('activeIndex');
    },
    get selectedIndex() {
      return store.select('selectedIndex');
    },
    virtual: true,
    get loopFocus() {
      return loopFocus();
    },
    get allowEscape() {
      return loopFocus() && !autoHighlightMode();
    },
    get focusItemOnOpen() {
      return queryChangedAfterOpen() || (selectionMode() === 'none' && !autoHighlightMode())
        ? false
        : 'auto';
    },
    get focusItemOnHover() {
      return highlightItemOnHover();
    },
    get resetOnPointerLeave() {
      return !keepHighlight();
    },
    get orientation() {
      return grid() ? 'horizontal' : undefined;
    },
    get rtl() {
      return direction() === 'rtl';
    },
    disabledIndices: EMPTY_ARRAY,
    get grid() {
      return grid() ? gridNavigation : undefined;
    },
    onNavigate(nextActiveIndex, event) {
      // Ignore automatic navigation while closed, including selected-index sync for inline lists.
      // Inline lists remain navigable while `open` is false, so still allow resets (clearing the
      // highlight when an unbound inline list unmounts, e.g. in a closed dialog).
      if (
        (!event && !untrack(open) && !(store.state.inline && nextActiveIndex === null)) ||
        untrack(transitionStatus) === 'ending'
      ) {
        return;
      }

      setIndices({
        activeIndex: nextActiveIndex,
        type: getHighlightReason(event),
        event,
      });
    },
  });

  const inputProps = mergeProps<HTMLProps>(
    listNavigation.reference!,
    {
      onKeyDown(event: BaseUIEvent<KeyboardEvent>) {
        // In grid mode the navigation treats ArrowLeft/ArrowRight as horizontal grid movement.
        // When the input has focus and no item is highlighted the user is still editing the
        // query, so let the input keep its native caret behavior.
        if (
          store.state.grid &&
          store.state.activeIndex == null &&
          (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
        ) {
          event.preventBaseUIHandler();
        }
      },
    },
    dismiss.reference!,
    click.reference!,
    role.reference!,
  );

  const popupProps = mergeProps<HTMLProps>(FOCUSABLE_POPUP_PROPS, dismiss.floating!);

  const listProps = mergeProps<HTMLProps>(listNavigation.floating!, role.floating!);

  // Combobox keeps focus on the input; item focus would incorrectly sync list navigation state
  // from DOM focus.
  const itemProps = omitKey(listNavigation.item as HTMLProps, 'onFocusIn');

  store.update({
    popupProps,
    listProps,
    inputProps,
    itemProps,
    activeTriggerProps: triggerProps,
  });

  // --- Synced values -----------------------------------------------------------------------

  createEffect(
    () => ({
      id: id(),
      items: storeItems(),
      inline: inlineProp(),
      openMethod: openMethod(),
      selectionMode: selectionMode(),
      name: name(),
      form: props.form,
      disabled: disabled(),
      readOnly: readOnly(),
      required: required(),
      grid: grid(),
      virtualized: virtualized(),
      openOnInputClick: openOnInputClick(),
      itemToStringLabel: itemToStringLabel(),
      modal: modal(),
      autoHighlight: autoHighlightMode(),
      isItemEqualToValue: isItemEqualToValue(),
      submitOnItemClick: submitOnItemClick(),
    }),
    (values) => {
      store.update({
        ...values,
        inputOwnsFormValue:
          values.selectionMode === 'none' && (values.inline || !store.state.inputInsidePopup),
      });
    },
  );

  // --- Rendering ---------------------------------------------------------------------------

  const derivedItems: ComboboxDerivedItemsContext = {
    get hasItems() {
      return hasItems();
    },
    get filteredItems() {
      return filteredItems() as any[];
    },
    get flatFilteredValues() {
      return flatFilteredValues();
    },
  };

  const serializedValue = () => {
    const raw = fieldRawValue();
    if (Array.isArray(raw)) {
      return '';
    }
    return stringifyAsValue(raw, props.itemToStringValue as ((item: any) => string) | undefined);
  };

  const hasMultipleSelection = () =>
    multiple() && Array.isArray(selectedValue()) && selectedValue().length > 0;
  const hiddenInputName = () =>
    multiple() || (selectionMode() === 'none' && store.select('inputOwnsFormValue'))
      ? undefined
      : name();

  function handleAutofill(event: Event & { currentTarget: HTMLInputElement }) {
    const hiddenInput = event.currentTarget;
    // The hidden input is controlled: like React, revert any value the change didn't commit.
    const syncHiddenInputValue = () => {
      const committedValue = String(untrack(serializedValue) ?? '');
      if (hiddenInput.value !== committedValue) {
        hiddenInput.value = committedValue;
      }
    };

    if (event.defaultPrevented || untrack(disabled) || untrack(readOnly)) {
      syncHiddenInputValue();
      return;
    }

    const nextValue = event.currentTarget.value;
    const nextValueLower = nextValue.toLowerCase();
    const details = createChangeEventDetails(REASONS.none, event);
    const itemToStringValue = untrack(() => props.itemToStringValue) as
      ((item: any) => string) | undefined;
    const mode = store.state.selectionMode;

    const findSerializedMatchIndex = () =>
      valuesRef.current.findIndex(
        (candidate) =>
          stringifyAsValue(candidate, itemToStringValue).toLowerCase() === nextValueLower ||
          stringifyValueLabel(candidate).toLowerCase() === nextValueLower,
      );

    function findMatchingValue() {
      // Preserve the original serialized matching, then fall back to rendered text,
      // which browsers can autofill for primitive values like `value="US">United States`.
      let matchingIndex = findSerializedMatchIndex();

      if (matchingIndex === -1) {
        matchingIndex = valuesRef.current.findIndex((_, index) => {
          const renderedLabel = labelsRef.current[index];
          return renderedLabel != null && renderedLabel.toLowerCase() === nextValueLower;
        });
      }

      return matchingIndex === -1 ? undefined : valuesRef.current[matchingIndex];
    }

    function handleChange() {
      // Browser autofill only writes a single scalar value.
      if (mode === 'multiple') {
        return;
      }

      if (mode === 'none') {
        setInputValue(nextValue, details);
        return;
      }

      const matchingValue = findMatchingValue();
      if (matchingValue != null) {
        setSelectedValue(matchingValue, details);
      }
    }

    // Only single-selection autofill matches against the registered values/labels.
    if (mode === 'single') {
      forceMount();
      if (untrack(items) && findSerializedMatchIndex() === -1) {
        // `forceMount` only refreshes the derived labels for the `items` prop. When serialized
        // matching misses, also mount the list so rendered labels are registered.
        store.set('forceMounted', true);
      }
    }
    // Wait for the force-mounted items to register: Solid renders them on its next flush, and the
    // composite list indexes them a microtask later.
    let attempts = 0;
    const run = () => {
      attempts += 1;
      if (mode === 'single' && findMatchingValue() == null && attempts < 8) {
        queueMicrotask(run);
        return;
      }
      handleChange();
      syncHiddenInputValue();
    };
    queueMicrotask(run);
  }

  const hiddenInputProps = mergeProps<HTMLProps>(validation.getValidationProps(disabled), {
    // Move focus when the hidden input is focused.
    onFocus() {
      if (store.state.inputInsidePopup) {
        (store.state.triggerElement as HTMLElement | null)?.focus();
        return;
      }

      (inputRef.current || (store.state.triggerElement as HTMLElement | null))?.focus();
    },
    // Handle browser autofill.
    onChange: handleAutofill,
    get id() {
      const currentId = id();
      return currentId && hiddenInputName() == null ? `${currentId}-hidden-input` : undefined;
    },
    get form() {
      return props.form;
    },
    get name() {
      return hiddenInputName();
    },
    get type() {
      return getHiddenInputType(
        field.setValidityData !== NOOP,
        name(),
        props.formAutoComplete,
        required(),
        props.inputRef,
      );
    },
    get autocomplete() {
      return props.formAutoComplete;
    },
    get disabled() {
      return disabled();
    },
    get required() {
      return required() && !hasMultipleSelection();
    },
    get readonly() {
      return readOnly();
    },
    get value() {
      return serializedValue();
    },
    get style() {
      return hiddenInputName() ? visuallyHiddenInput : visuallyHiddenInputPinned;
    },
    onInvalid: handleHiddenInputInvalid,
    tabindex: -1,
    'aria-hidden': 'true',
  });

  function hiddenInputRef(element: HTMLInputElement) {
    hiddenInputElement = element;
    validation.inputRef.current = element;
    applyRef(untrack(() => props.inputRef) as RefProp<HTMLInputElement>, element);
  }

  onCleanup(() => {
    if (hiddenInputElement && validation.inputRef.current === hiddenInputElement) {
      validation.inputRef.current = null;
    }
  });

  const multipleHiddenValues = createMemo(() => {
    const value = selectedValue();
    if (!multiple() || !Array.isArray(value) || !name()) {
      return EMPTY_ARRAY as string[];
    }
    const itemToStringValue = props.itemToStringValue as ((item: any) => string) | undefined;
    return value.map((item: any) => stringifyAsValue(item, itemToStringValue));
  });

  // A component boundary keeps the element creation untracked.
  const HiddenInput = () =>
    renderElement('input', {}, { props: hiddenInputProps, ref: hiddenInputRef });

  return (
    <ComboboxRootContext value={store}>
      <ComboboxDerivedItemsContext value={derivedItems}>
        {props.children}
        <HiddenInput />
        <Show when={multipleHiddenValues().length > 0}>
          <For each={multipleHiddenValues()}>
            {(value) => (
              <input
                type="hidden"
                form={props.form}
                name={name()}
                value={value}
                disabled={disabled()}
              />
            )}
          </For>
        </Show>
      </ComboboxDerivedItemsContext>
    </ComboboxRootContext>
  );
}

/**
 * Returns a live view of `props` without `key`.
 */
function omitKey(props: HTMLProps, key: string): HTMLProps {
  return new Proxy(props, {
    get(target, property, receiver) {
      return property === key ? undefined : Reflect.get(target, property, receiver);
    },
    has(target, property) {
      return property !== key && Reflect.has(target, property);
    },
    ownKeys(target) {
      return Reflect.ownKeys(target).filter((property) => property !== key);
    },
    getOwnPropertyDescriptor(target, property) {
      return property === key ? undefined : Reflect.getOwnPropertyDescriptor(target, property);
    },
  });
}

/**
 * Reads a controlled prop. Untracked reads (store snapshots taken in handlers and ref callbacks)
 * run without an owner: a compiled conditional prop (`value={a ? b : c}`) creates a memo on
 * every read that has an owner, which Solid forbids inside ref callbacks.
 */
function readProp<T>(read: () => T): T {
  return getObserver() ? read() : runWithOwner(null, read);
}

type SelectionMode = 'single' | 'multiple' | 'none';

type ComboboxItemValueType<ItemValue, Mode extends SelectionMode> = Mode extends 'multiple'
  ? ItemValue[]
  : ItemValue;

interface ComboboxRootProps<ItemValue, Item = ItemValue> {
  children?: JSX.Element;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the internal input.
   * Useful when the combobox is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The id of the component.
   */
  id?: string | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to choose a different option from the popup.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the popup is initially open.
   *
   * To render a controlled popup, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the popup is currently open. Use when controlled.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the popup is opened or closed.
   */
  onOpenChange?:
    ((open: boolean, eventDetails: AriaCombobox.OpenChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the popup is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the popup opens when clicking the input.
   * @default true
   */
  openOnInputClick?: boolean | undefined;
  /**
   * Whether the first matching item is highlighted automatically.
   * - `false`: do not highlight automatically.
   * - `true`: highlight after the user types and keep the highlight while the query changes.
   * - `'always'`: highlight the first item as soon as the list opens.
   * @default false
   */
  autoHighlight?: boolean | 'always' | undefined;
  /**
   * Whether the highlighted item should be preserved when the pointer leaves the list.
   * @default false
   */
  keepHighlight?: boolean | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the input when the end of the list is reached while using the arrow keys. The first item can then be reached by pressing <kbd>ArrowDown</kbd> again from the input, or the last item can be reached by pressing <kbd>ArrowUp</kbd> from the input.
   * The input is always included in the focus loop per [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).
   * When disabled, focus does not move when on the last element and the user presses <kbd>ArrowDown</kbd>, or when on the first element and the user presses <kbd>ArrowUp</kbd>.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * The input value of the combobox. Use when controlled.
   */
  inputValue?: string | number | readonly string[] | undefined;
  /**
   * Callback fired when the input value of the combobox changes.
   */
  onInputValueChange?:
    ((value: string, eventDetails: AriaCombobox.ChangeEventDetails) => void) | undefined;
  /**
   * The uncontrolled input value when initially rendered.
   *
   * To render a controlled input, use the `inputValue` prop instead.
   */
  defaultInputValue?: string | number | readonly string[] | undefined;
  /**
   * A ref to imperative actions: a ref object (`{ current: null }`) or a callback receiving them.
   * - `unmount`: Ends the closing phase of the combobox after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `onOpenChange` first, otherwise the combobox completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the combobox imperatively when called.
   */
  actionsRef?: ActionsRef<AriaCombobox.Actions> | undefined;
  /**
   * Callback fired when an item is highlighted or unhighlighted.
   * Receives the highlighted item value (or `undefined` if no item is highlighted) and event details with a `reason` property describing why the highlight changed.
   * The `reason` can be:
   * - `'keyboard'`: the highlight changed due to keyboard navigation.
   * - `'pointer'`: the highlight changed due to pointer hovering. The event may be a `MouseEvent`
   *   rather than a `PointerEvent`.
   * - `'none'`: the highlight changed for another reason, such as typing, `autoHighlight`, the
   *   item list changing, or the popup opening or closing.
   */
  onItemHighlighted?:
    | ((itemValue: ItemValue | undefined, eventDetails: AriaCombobox.HighlightEventDetails) => void)
    | undefined;
  /**
   * A ref to the hidden input element.
   */
  inputRef?: RefProp<HTMLInputElement> | undefined;
  /**
   * Whether list items are presented in a grid layout.
   * When enabled, arrow keys navigate across rows and columns inferred from DOM rows.
   * @default false
   */
  grid?: boolean | undefined;
  /**
   * The items to be displayed in the list.
   * Can be a flat array of items, an array of groups with items, or a collection created by
   * the `createItems()` function, which derives each item's selection value and label.
   * Nullish entries are not supported: remove them from the data before passing it.
   */
  items?:
    readonly any[] | readonly Group<any>[] | ComboboxItemCollection<Item, ItemValue> | undefined;
  /**
   * Filtered items to display in the list.
   * When provided, the list uses these items instead of filtering the `items` prop internally.
   * When `items` is also provided, this array must preserve its flat or grouped structure.
   * With a `createItems()` collection, pass source items rather than derived values.
   * Nullish entries are not supported, as in `items`.
   * Use when you want to control filtering logic externally with the `useFilter()` hook.
   */
  filteredItems?: readonly Item[] | readonly Group<Item>[] | undefined;
  /**
   * Filter function used to match items vs input query.
   * Receives the source item, which is the derived value's item when `items` is a `createItems()`
   * collection, and the item itself otherwise.
   */
  filter?:
    | null
    | ((item: Item, query: string, itemToString?: (item: Item) => string) => boolean)
    | undefined;
  /**
   * When the item values are objects (`<Combobox.Item value={object}>`), this function converts the object value to a string representation for display in the input.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   */
  itemToStringLabel?: ((itemValue: ItemValue) => string) | undefined;
  /**
   * When the item values are objects (`<Combobox.Item value={object}>`), this function converts the object value to a string representation for form submission.
   * If the shape of the object is `{ value, label }`, the value will be used automatically without needing to specify this prop.
   */
  itemToStringValue?: ((itemValue: ItemValue) => string) | undefined;
  /**
   * Custom comparison logic used to determine if a combobox item value matches the current selected value. Useful when item values are objects without matching referentially.
   * Defaults to `Object.is` comparison.
   */
  isItemEqualToValue?: ((itemValue: ItemValue, value: ItemValue) => boolean) | undefined;
  /**
   * Whether the items are being externally virtualized.
   * @default false
   */
  virtualized?: boolean | undefined;
  /**
   * Whether the list is rendered inline without using the component's own popup.
   *
   * Specify `open` unconditionally in conjunction with this prop so the list is considered
   * visible: `<Combobox.Root inline open>`
   * @default false
   */
  inline?: boolean | undefined;
  /**
   * Determines if the popup enters a modal state when open.
   * - `true`: user interaction is limited to the popup: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * @default false
   */
  modal?: boolean | undefined;
  /**
   * The maximum number of items to display in the list.
   * @default -1
   */
  limit?: number | undefined;
  /**
   * Controls how the component behaves with respect to list filtering and inline autocompletion.
   * - `list` (default): items are dynamically filtered based on the input value. The input value does not change based on the active item.
   * - `both`: items are dynamically filtered based on the input value, which will temporarily change based on the active item (inline autocompletion).
   * - `inline`: items are static (not filtered), and the input value will temporarily change based on the active item (inline autocompletion).
   * - `none`: items are static (not filtered), and the input value will not change based on the active item.
   * @default 'list'
   */
  autoComplete?: 'list' | 'both' | 'inline' | 'none' | undefined;
  /**
   * Provides a hint to the browser for autofill on the hidden input element.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
   */
  formAutoComplete?: string | undefined;
  /**
   * The locale to use for string comparison.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * Whether clicking an item should submit the owning form.
   * @default false
   */
  submitOnItemClick?: boolean | undefined;
  /**
   * INTERNAL: When `selectionMode` is `none`, controls whether selecting an item fills the input.
   */
  fillInputOnItemPress?: boolean | undefined;
}

export interface AriaComboboxState {}

export type AriaComboboxProps<
  Value,
  Mode extends SelectionMode = 'none',
  Item = Value,
> = ComboboxRootProps<Value, Item> & {
  /**
   * How the combobox should remember the selected value.
   * - `single`: Remembers the last selected value.
   * - `multiple`: Remember all selected values.
   * - `none`: Do not remember the selected value.
   */
  selectionMode: Mode;
  /**
   * The selected value of the combobox. Use when controlled.
   */
  selectedValue?: ComboboxItemValueType<Value, Mode> | null | undefined;
  /**
   * The uncontrolled selected value of the combobox when it's initially rendered.
   *
   * To render a controlled combobox, use the `selectedValue` prop instead.
   */
  defaultSelectedValue?: ComboboxItemValueType<Value, Mode> | null | undefined;
  /**
   * Callback fired when the selected value of the combobox changes.
   */
  onSelectedValueChange?:
    | ((
        value: ComboboxItemValueType<Value, Mode>,
        eventDetails: AriaCombobox.ChangeEventDetails,
      ) => void)
    | undefined;
};

export namespace AriaCombobox {
  export type Props<Value, Mode extends SelectionMode = 'none', Item = Value> = AriaComboboxProps<
    Value,
    Mode,
    Item
  >;
  export type State = AriaComboboxState;

  export interface Actions {
    unmount: () => void;
    close: () => void;
  }

  export type HighlightEventReason =
    typeof REASONS.keyboard | typeof REASONS.pointer | typeof REASONS.none;
  export type HighlightEventDetails = BaseUIHighlightEventDetails<
    HighlightEventReason,
    { index: number }
  >;

  export type ChangeEventReason =
    | typeof REASONS.triggerPress
    | typeof REASONS.inputPress
    | typeof REASONS.outsidePress
    | typeof REASONS.itemPress
    | typeof REASONS.closePress
    | typeof REASONS.escapeKey
    | typeof REASONS.listNavigation
    | typeof REASONS.focusOut
    | typeof REASONS.inputChange
    | typeof REASONS.inputClear
    | typeof REASONS.clearPress
    | typeof REASONS.chipRemovePress
    | typeof REASONS.cancelOpen
    | typeof REASONS.imperativeAction
    | typeof REASONS.none;
  export type OpenChangeEventDetails = ChangeEventDetails & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };
  export type ChangeEventDetails = BaseUIChangeEventDetails<ChangeEventReason> & {
    /**
     * When `reason` is `input-clear` in multiple mode, indicates whether an item press caused the
     * clear. Automatic cleanup clears omit this property.
     */
    isItemPress?: boolean | undefined;
  };
}
