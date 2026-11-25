import { createEffect, createMemo, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import { useSelectRootContext } from '../root/SelectRootContext';
import { useCompositeListItem } from '../../internals/composite/list/CompositeList';
import type {
  BaseUIComponentProps,
  BaseUIEvent,
  HTMLProps,
  NonNativeButtonProps,
} from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { SelectItemContext } from './SelectItemContext';
import { createButton } from '../../internals/use-button/createButton';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import {
  compareItemEquality,
  removeItem,
  resolveSelectedIndex,
} from '../../internals/itemEquality';
import { isVirtualClick } from '../../utils/popups/event';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';

/**
 * An individual option in the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItem(componentProps: SelectItem.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'value',
    'label',
    'disabled',
    'nativeButton',
  );

  const store = useSelectRootContext();

  const itemValue = () => componentProps.value ?? null;

  const textRef = createRefObject<HTMLElement | null>(null);
  const listItem = useCompositeListItem({
    label: () => componentProps.label ?? textRef.current?.textContent ?? null,
  });
  // A memo: the list map changes whenever any item registers, and the effects below must only
  // re-run when this item's own index changes (upstream's effect dependencies).
  const index = createMemo(listItem.index);

  const multiple = () => store.select('multiple');
  const selectDisabled = () => store.select('disabled');
  const isItemEqualToValue = () => store.select('isItemEqualToValue');

  const disabled = () => selectDisabled() || (componentProps.disabled ?? false);
  const highlighted = () => store.select('isActive', index());
  const activeWhileOpen = () => store.select('isActiveWhileOpen', index());
  const selected = () => store.select('isSelected', itemValue());
  const selectedByFocus = () => store.select('isSelectedByFocus', index());

  let itemElement: HTMLElement | null = null;

  createEffect(
    () => [index(), itemValue()] as const,
    ([currentIndex, currentValue]) => {
      if (currentIndex < 0) {
        return undefined;
      }
      const values = store.context.valuesRef.current;
      values[currentIndex] = currentValue;

      return () => {
        // Solid runs each item's cleanup right before its own update (React runs every cleanup
        // first): when items swap indexes, another item may already own this slot.
        if (Object.is(values[currentIndex], currentValue)) {
          delete values[currentIndex];
        }
      };
    },
  );

  createEffect(
    () => [index(), multiple(), isItemEqualToValue(), itemValue()] as const,
    ([currentIndex, isMultiple, comparer, currentValue]) => {
      if (currentIndex < 0) {
        return;
      }

      const selectedValue = store.state.selectedValue;

      const currentSelectedIndex = store.state.selectedIndex;
      let nextIndex = currentSelectedIndex;
      let claims: boolean;
      if (isMultiple && Array.isArray(selectedValue)) {
        // The claiming item also owns the text ref that aligns the popup.
        nextIndex = resolveSelectedIndex(
          currentIndex,
          currentValue,
          store.context.valuesRef.current,
          selectedValue,
          comparer,
          currentSelectedIndex,
        );
        claims = nextIndex === currentIndex;
        if (currentIndex === currentSelectedIndex && !claims) {
          store.context.selectedItemTextRef.current = null;
        }
      } else {
        claims =
          selectedValue !== undefined && compareItemEquality(currentValue, selectedValue, comparer);
        if (claims) {
          nextIndex = currentIndex;
        }
      }
      store.set('selectedIndex', nextIndex);

      // Make sure SelectPopup can measure the selected item on first open.
      // SelectItemText can still update this ref later when focus moves.
      if (claims && textRef.current) {
        store.context.selectedItemTextRef.current = textRef.current;
      }
    },
  );

  let pointerType: string = 'mouse';
  let allowMouseSelection = false;

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: () => true,
    native: () => componentProps.nativeButton ?? false,
    composite: () => true,
  });

  const state: SelectItemState = {
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

  function commitSelection(event: MouseEvent | KeyboardEvent | PointerEvent) {
    // A forced-open select (`open`/`defaultOpen`) can still receive item activations even
    // when the root is disabled or read-only, so guard the commit here too.
    if (store.state.disabled || store.state.readOnly) {
      return;
    }

    const value = untrack(itemValue);
    const comparer = store.state.isItemEqualToValue;
    const selectedValue = store.state.selectedValue;
    if (store.state.selectionMode === 'multiple') {
      const currentValue = Array.isArray(selectedValue) ? selectedValue : [];
      const nextValue = untrack(selected)
        ? removeItem(currentValue, value, comparer)
        : [...currentValue, value];
      store.context.setValue(nextValue, createChangeEventDetails(REASONS.itemPress, event));
    } else {
      store.context.setValue(value, createChangeEventDetails(REASONS.itemPress, event));
      store.setOpen(false, createChangeEventDetails(REASONS.itemPress, event));
    }
  }

  function resetDragMovement() {
    store.context.selectionRef.current.dragY = 0;
  }

  const defaultProps: HTMLProps = {
    role: 'option',
    get 'aria-selected'() {
      return selected() ? 'true' : 'false';
    },
    get tabindex() {
      return activeWhileOpen() ? 0 : -1;
    },
    onKeyDown(event: BaseUIEvent<KeyboardEvent>) {
      store.set('activeIndex', untrack(index));

      if (event.key === ' ' && store.context.typingRef.current) {
        // `createButton` skips Space activation for `role="option"` items when the keydown
        // is `defaultPrevented`, keeping typeahead spaces from committing a selection.
        event.preventDefault();
      }
    },
    onClick(event: MouseEvent) {
      const isMouseClick = pointerType !== 'touch';
      const clickPointerType = (event as PointerEvent).pointerType;
      const isVirtualMouseClick =
        isMouseClick &&
        isVirtualClick(event) &&
        // Generic no-pointer `detail === 0` clicks stay tied to highlight state. Virtual
        // clicks that carry browser pointer data, including an empty string from assistive
        // technology, can activate unhighlighted items.
        (clickPointerType !== undefined || untrack(highlighted));
      // With alignItemWithTrigger, opening can place an item under the cursor. Real mouse
      // clicks must start on the item, while virtual clicks represent explicit keyboard or
      // assistive technology activation.
      const isInvalidMouseClick = isMouseClick && !isVirtualMouseClick && !allowMouseSelection;

      allowMouseSelection = false;

      if (untrack(disabled) || isInvalidMouseClick) {
        return;
      }

      commitSelection(event);
    },
    onPointerEnter(event: PointerEvent) {
      pointerType = event.pointerType;
    },
    onPointerMove(event: PointerEvent) {
      if (event.pointerType === 'mouse' && event.buttons === 1) {
        const selection = store.context.selectionRef.current;
        selection.dragY += event.movementY;

        if (selection.dragY ** 2 >= 64) {
          selection.allowUnselectedMouseUp = true;
        }
      }
    },
    onPointerDown(event: PointerEvent) {
      pointerType = event.pointerType;
      allowMouseSelection = true;
      resetDragMovement();
    },
    onMouseUp() {
      resetDragMovement();

      if (untrack(disabled) || pointerType === 'touch') {
        return;
      }

      // Regular clicks are committed by the click event.
      if (allowMouseSelection) {
        return;
      }

      const isSelected = untrack(selected);
      const disallowSelectedMouseUp =
        !store.context.selectionRef.current.allowSelectedMouseUp && isSelected;
      const disallowUnselectedMouseUp =
        !store.context.selectionRef.current.allowUnselectedMouseUp && !isSelected;

      if (disallowSelectedMouseUp || disallowUnselectedMouseUp) {
        return;
      }

      allowMouseSelection = true;
      // Drag selection has no mousedown on the item. Focus it before the synthetic click so
      // arrow-key navigation continues from the selected item.
      itemElement?.focus({ preventScroll: true });
      itemElement?.click();
      allowMouseSelection = false;
    },
  };

  const itemProps = createDynamicPropsSource(() => {
    const props = store.context.itemProps;
    return typeof props === 'function' ? props({}) : props;
  });

  const contextValue: SelectItemContext = {
    get selected() {
      return selected();
    },
    get index() {
      return index();
    },
    textRef,
    get selectedByFocus() {
      return selectedByFocus();
    },
  };

  // A component boundary keeps the element creation untracked, inside the provider.
  const Element = () =>
    renderElement('div', componentProps, {
      ref: [
        buttonRef,
        listItem.ref,
        (element: HTMLElement) => {
          itemElement = element;
        },
      ],
      state,
      props: [itemProps, defaultProps, elementProps, getButtonProps],
    });

  return (
    <SelectItemContext value={contextValue}>
      <Element />
    </SelectItemContext>
  );
}

export interface SelectItemState {
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

export interface SelectItemProps
  extends NonNativeButtonProps,
    Omit<BaseUIComponentProps<'div', SelectItemState>, 'id' | 'disabled'> {
  children?: JSX.Element;
  /**
   * A unique value that identifies this select item.
   * @default null
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Specifies the text label to use when the item is matched during keyboard text navigation.
   *
   * Defaults to the item text content if not provided.
   */
  label?: string | undefined;
}

export namespace SelectItem {
  export type State = SelectItemState;
  export type Props = SelectItemProps;
}
