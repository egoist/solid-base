import { flush, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { useComboboxChipsContext } from '../chips/ComboboxChipsContext';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { useCompositeListItem } from '../../internals/composite/list/CompositeList';
import { ComboboxChipContext } from './ComboboxChipContext';
import { stopEvent } from '../../utils/popups/event';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { getChipNavigationKeys, getIndexAfterChipRemoval } from '../utils/parts';

/**
 * An individual chip that represents a value in a multiselectable input.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Combobox](https://base.egoist.dev/components/combobox)
 */
export function ComboboxChip(componentProps: ComboboxChip.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const store = useComboboxRootContext();
  const { chipsRef } = useComboboxChipsContext()!;
  const direction = useDirection();

  const disabled = () => store.select('disabled');
  const readOnly = () => store.select('readOnly');

  const { ref, index } = useCompositeListItem();

  function handleKeyDown(event: KeyboardEvent) {
    const currentIndex = untrack(index);
    let nextIndex: number | undefined = currentIndex;
    const [previousChipKey, nextChipKey] = getChipNavigationKeys(untrack(direction));
    const selectedValue: any[] = Array.isArray(store.state.selectedValue)
      ? store.state.selectedValue
      : [];

    if (event.key === previousChipKey) {
      event.preventDefault();
      if (currentIndex > 0) {
        nextIndex = currentIndex - 1;
      } else {
        nextIndex = undefined;
      }
    } else if (event.key === nextChipKey) {
      event.preventDefault();
      if (currentIndex < chipsRef.current.length - 1) {
        nextIndex = currentIndex + 1;
      } else {
        nextIndex = undefined;
      }
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      nextIndex = getIndexAfterChipRemoval(currentIndex, selectedValue.length);

      stopEvent(event);

      store.context.setIndices({
        activeIndex: null,
        selectedIndex: null,
        type: REASONS.keyboard,
        event,
      });
      store.context.setSelectedValue(
        selectedValue.filter((_: any, i: number) => i !== currentIndex),
        createChangeEventDetails(REASONS.none, event),
      );
      // Commit the removal before focusing so `chipsRef` reflects the remaining chips.
      flushChips();
    } else if (event.key === 'Enter' || event.key === ' ') {
      stopEvent(event);
      nextIndex = undefined;
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      stopEvent(event);
      store.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event));
      // The input may mount when opening.
      flush();
      nextIndex = undefined;
    } else if (
      // Check for printable characters (letters, numbers, symbols)
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      nextIndex = undefined;
    }

    return nextIndex;
  }

  // Removes the chips that unmounted from `chipsRef`. The composite list re-indexes its items in
  // a microtask, so prune disconnected elements now.
  function flushChips() {
    flush();
    chipsRef.current = chipsRef.current.filter((element) => element?.isConnected);
  }

  // Chips re-created by the removal (such as chips rendered from `Combobox.Value`) register with
  // the composite list a microtask later: wait for the chip at `index` to be connected.
  function focusChip(index: number, attempts = 0) {
    const chip = chipsRef.current[index];
    if (chip?.isConnected) {
      chip.focus();
      return;
    }
    if (attempts < 5) {
      queueMicrotask(() => focusChip(index, attempts + 1));
    }
  }

  const state: ComboboxChipState = {
    get disabled() {
      return disabled();
    },
  };

  // Created inside the provider: the children read it.
  const Element = () =>
    renderElement('div', componentProps, {
      ref,
      state,
      props: [
        {
          tabindex: -1,
          get 'aria-disabled'() {
            return disabled() || undefined;
          },
          get 'aria-readonly'() {
            return readOnly() || undefined;
          },
          onKeyDown(event: KeyboardEvent) {
            if (store.state.disabled || store.state.readOnly) {
              return;
            }

            const nextIndex = handleKeyDown(event);

            if (nextIndex === undefined) {
              store.context.inputRef.current?.focus();
            } else {
              focusChip(nextIndex);
            }
          },
        },
        elementProps,
      ],
    });

  const contextValue: ComboboxChipContext = { index };

  return (
    <ComboboxChipContext value={contextValue}>
      <Element />
    </ComboboxChipContext>
  );
}

export interface ComboboxChipState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface ComboboxChipProps extends BaseUIComponentProps<'div', ComboboxChipState> {}

export namespace ComboboxChip {
  export type State = ComboboxChipState;
  export type Props = ComboboxChipProps;
}
