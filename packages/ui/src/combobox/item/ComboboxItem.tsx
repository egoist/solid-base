import { createEffect, flush, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  useComboboxRootContext,
  useComboboxDerivedItemsContext,
} from '../root/ComboboxRootContext';
import { useCompositeListItem } from '../../internals/composite/list/CompositeList';
import type { BaseUIComponentProps, HTMLProps, NonNativeButtonProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { ComboboxItemContext } from './ComboboxItemContext';
import { createButton } from '../../internals/use-button/createButton';
import { useComboboxRowContext } from '../row/ComboboxRowContext';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';
import {
  compareItemEquality,
  findItemIndex,
  resolveSelectedIndex,
} from '../../internals/itemEquality';

/**
 * An individual item in the list.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Combobox](https://base.egoist.dev/components/combobox)
 */
export function ComboboxItem(componentProps: ComboboxItem.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'value',
    'index',
    'disabled',
    'nativeButton',
  );

  const store = useComboboxRootContext();
  const derivedItems = useComboboxDerivedItemsContext();
  const isRow = useComboboxRowContext();

  const indexProp = () => componentProps.index;
  const listItem = useCompositeListItem({ index: indexProp });

  const itemValue = () => componentProps.value ?? null;
  const virtualized = () => store.select('virtualized');
  const selectionMode = () => store.select('selectionMode');
  const isItemEqualToValue = () => store.select('isItemEqualToValue');
  const hasItems = () => derivedItems.hasItems;

  const disabled = () => store.select('disabled') || (componentProps.disabled ?? false);
  const selectable = () => selectionMode() !== 'none';

  // The virtualized fallback (no `index` prop) resolves the index from the filtered items.
  const indexFromFilter = () =>
    virtualized() && indexProp() == null
      ? findItemIndex(derivedItems.flatFilteredValues, itemValue(), isItemEqualToValue())
      : undefined;

  const index = () => indexProp() ?? indexFromFilter() ?? listItem.index();
  const hasRegistered = () => index() !== -1;

  const highlighted = () => store.select('isActive', index());
  const selected = () => store.select('isSelected', itemValue()) && selectable();

  const id = () => {
    const rootId = store.select('id');
    return rootId != null && hasRegistered() ? `${rootId}-${index()}` : undefined;
  };

  let itemElement: HTMLDivElement | null = null;

  createEffect(
    () => [hasRegistered() && (virtualized() || indexProp() != null), index()] as const,
    ([shouldRun, currentIndex]) => {
      if (!shouldRun) {
        return undefined;
      }

      const list = store.context.listRef.current;
      list[currentIndex] = itemElement;

      return () => {
        delete list[currentIndex];
      };
    },
  );

  createEffect(
    () => [hasRegistered() && !hasItems(), index(), itemValue()] as const,
    ([shouldRun, currentIndex, value]) => {
      if (!shouldRun) {
        return undefined;
      }

      const visibleValues = store.context.valuesRef.current;
      visibleValues[currentIndex] = value;

      return () => {
        delete visibleValues[currentIndex];
      };
    },
  );

  createEffect(
    () => [hasRegistered() && !hasItems(), index(), itemValue(), isItemEqualToValue()] as const,
    ([shouldRun, currentIndex, value, comparer]) => {
      if (!shouldRun) {
        return;
      }

      // Runs while closed as well (the list can stay mounted via `keepMounted` or a
      // force-mount) so the index tracks the item's composite position, keeping features
      // like closed-trigger typeahead in sync when the rendered order changes.
      const selectedValue = store.state.selectedValue;

      let nextIndex = store.state.selectedIndex;
      if (store.state.selectionMode === 'multiple' && Array.isArray(selectedValue)) {
        nextIndex = resolveSelectedIndex(
          currentIndex,
          value,
          store.context.valuesRef.current,
          selectedValue,
          comparer,
          nextIndex,
        );
      } else if (compareItemEquality(value, selectedValue, comparer)) {
        nextIndex = currentIndex;
      }
      store.set('selectedIndex', nextIndex);
    },
  );

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: () => true,
    native: () => componentProps.nativeButton ?? false,
    composite: () => true,
  });

  const state: ComboboxItemState = {
    get disabled() {
      return disabled();
    },
    get selected() {
      return selected();
    },
    get highlighted() {
      return highlighted();
    },
  };

  function commitSelection(nativeEvent: MouseEvent) {
    function selectItem() {
      store.context.handleSelection(nativeEvent, untrack(itemValue));
    }

    if (store.state.submitOnItemClick) {
      selectItem();
      flush();
      store.context.requestSubmit();
    } else {
      selectItem();
    }
  }

  function handlePointerDownCapture(event: PointerEvent) {
    // The compat `mouseup` only fires for the primary pointer, so a non-primary
    // touch must not overwrite the shared ref — a mismatch would make the primary
    // pointer's release read as a drag-select and commit a second time after `click`.
    if (event.isPrimary) {
      store.context.pointerDownItemRef.current = event.currentTarget as Element;
    }
    event.preventDefault();
  }

  onCleanup(() => {
    itemElement?.removeEventListener('pointerdown', handlePointerDownCapture, true);
  });

  const defaultProps: HTMLProps = {
    get id() {
      return id();
    },
    role: isRow ? 'gridcell' : 'option',
    get 'aria-selected'() {
      return selectable() ? selected() : undefined;
    },
    // Focusable items steal focus from the input upon mouseup.
    tabindex: undefined,
    onMouseDown(event: MouseEvent) {
      // iOS Safari can emit a synthetic mousedown for touch taps without a preceding
      // pointerdown. Prevent default here too so tapping an item does not blur the input.
      event.preventDefault();
    },
    onClick(event: MouseEvent) {
      if (untrack(disabled) || store.state.readOnly) {
        return;
      }

      commitSelection(event);
    },
    onMouseUp(event: MouseEvent) {
      const pointerStartedOnItem = store.context.pointerDownItemRef.current === event.currentTarget;
      store.context.pointerDownItemRef.current = null;

      if (
        untrack(disabled) ||
        store.state.readOnly ||
        event.button !== 0 ||
        pointerStartedOnItem ||
        !untrack(highlighted)
      ) {
        return;
      }

      commitSelection(event);
    },
  };

  // Created inside the provider: the children read it.
  const Element = () =>
    renderElement('div', componentProps, {
      ref: [
        buttonRef,
        listItem.ref,
        (el: HTMLDivElement) => {
          itemElement?.removeEventListener('pointerdown', handlePointerDownCapture, true);
          itemElement = el;
          el.addEventListener('pointerdown', handlePointerDownCapture, true);
        },
      ],
      state,
      props: [
        createDynamicPropsSource(() => store.select('itemProps')),
        defaultProps,
        elementProps,
        getButtonProps,
      ],
    });

  const contextValue: ComboboxItemContext = { selected };

  return (
    <ComboboxItemContext value={contextValue}>
      <Element />
    </ComboboxItemContext>
  );
}

export interface ComboboxItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface ComboboxItemProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'div', ComboboxItemState>, 'id'> {
  children?: JSX.Element;
  /**
   * An optional click handler for the item when selected.
   * It fires when clicking the item with the pointer, as well as when pressing `Enter` with the keyboard if the item is highlighted when the `Input` or `List` element has focus.
   */
  onClick?: BaseUIComponentProps<'div', ComboboxItemState>['onClick'] | undefined;
  /**
   * The index of the item in the list. Improves performance when specified by avoiding the need to calculate the index automatically from the DOM.
   */
  index?: number | undefined;
  /**
   * A unique value that identifies this item.
   * @default null
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ComboboxItem {
  export type State = ComboboxItemState;
  export type Props = ComboboxItemProps;
}
