import { createEffect, createSignal, flush, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { platform } from '@egoist/solid-base-utils/platform';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { createBaseUiId } from '../../internals/baseUiId';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';
import {
  useFilterDropdownItemContext,
  useFilterDropdownRootContext,
} from '../root/FilterDropdownRootContext';
import { refocusOwner, isRefocusingOwner } from '../utils/refocusOwner';

/**
 * @internal
 */
export function FilterDropdownInput(componentProps: FilterDropdownInputHostProps): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'id',
    'disabled',
    'activeItemId',
    'navigationProps',
  );

  // Browsers flag a form field with neither an id nor a name.
  const id = createBaseUiId(() => componentProps.id as string | undefined);

  const context = useFilterDropdownRootContext();
  const { listRef } = useFilterDropdownItemContext();

  // IME text isn't committed until the composition ends, so filtering waits for it.
  const [composingValue, setComposingValue] = createSignal<string | null>(null);
  let isComposing = false;

  function commitValue(input: HTMLInputElement, nextValue: string, nativeEvent: Event) {
    // The input keeps focus until the popup unmounts. The query is held in place while it
    // animates out, so an edit made then would change the committed value behind it.
    if (context.open) {
      const reason = nextValue === '' ? REASONS.inputClear : REASONS.inputChange;
      context.onValueChange(nextValue, createChangeEventDetails(reason, nativeEvent));
      flush();
    }
    // A rejected change (a canceled or controlled value that stayed put) reverts the typed text.
    if (input.value !== context.value) {
      input.value = context.value;
    }
  }

  const state: FilterDropdownInput.State = {
    get highlighted() {
      return (
        context.inputFocusVisible &&
        (!context.keyboardModality || componentProps.activeItemId == null)
      );
    },
  };

  const inputProps: HTMLProps = {
    get id() {
      return id();
    },
    type: 'text',
    get disabled() {
      return context.disabled || componentProps.disabled;
    },
    get 'aria-activedescendant'() {
      return componentProps.activeItemId;
    },
    role: 'searchbox',
    inputmode: 'search',
    autocomplete: 'off',
    spellcheck: 'false',
    autocorrect: 'off',
    autocapitalize: 'none',
    // The aria-autocomplete 'list' value is only valid with `aria-haspopup` so we depend
    // on the searchbox role to communicate affordance, with an input label as fallback
    // https://w3c.github.io/aria/#aria-autocomplete
    'aria-autocomplete': undefined,
    get 'aria-controls'() {
      return context.listId;
    },
    onCompositionStart(event: CompositionEvent) {
      // Some Android keyboards treat all typing as one composition.
      if (platform.os.android) {
        return;
      }
      isComposing = true;
      setComposingValue((event.currentTarget as HTMLInputElement).value);
    },
    onCompositionEnd(event: CompositionEvent) {
      if (!isComposing) {
        return;
      }
      isComposing = false;
      const input = event.currentTarget as HTMLInputElement;
      setComposingValue(null);
      commitValue(input, input.value, event);
    },
    onInput(event: InputEvent) {
      const input = event.currentTarget as HTMLInputElement;
      if (isComposing) {
        setComposingValue(input.value);
        return;
      }
      commitValue(input, input.value, event);
    },
    onKeyDown() {
      context.setKeyboardModality(true);
    },
    onPointerDown() {
      context.setKeyboardModality(false);
    },
    onMouseEnter(event: MouseEvent) {
      context.setKeyboardModality(false);
      // Take focus so typing filters immediately.
      if (context.open) {
        refocusOwner(event.currentTarget as HTMLElement);
      }
    },
    onFocus(event: FocusEvent) {
      context.setInputFocusVisible(true);

      // A screen reader that followed `aria-activedescendant` put real focus on the item, so
      // focus returning from an item means the user moved back to the input on purpose and
      // the highlight no longer reflects where they are. The list's own key replay and
      // pointer refocus also pass through here and keep it.
      if (context.autoHighlight === 'always' || isRefocusingOwner()) {
        return;
      }
      const from = event.relatedTarget as HTMLElement | null;
      if (from !== null && listRef.current.includes(from)) {
        context.setActiveIndex(null);
      }
    },
    onBlur() {
      context.setInputFocusVisible(false);
    },
  };

  // The displayed value is written imperatively, and only when it differs from the DOM: a
  // `value` prop is rewritten whenever the element's props re-apply, which moves the caret.
  const displayedValue = () => composingValue() ?? context.value;

  let inputElement: HTMLElement | null = null;
  createEffect(displayedValue, (value) => {
    const input = inputElement as HTMLInputElement | null;
    if (input && input.value !== value) {
      input.value = value;
    }
  });
  onCleanup(() => {
    if (inputElement && context.focusOwnerRef.current === inputElement) {
      context.focusOwnerRef.current = null;
    }
  });

  return renderElement('input', componentProps, {
    state,
    ref: (element: HTMLElement) => {
      inputElement = element;
      const value = untrack(displayedValue);
      if ((element as HTMLInputElement).value !== value) {
        (element as HTMLInputElement).value = value;
      }
      context.focusOwnerRef.current = element;
    },
    props: [
      createDynamicPropsSource(() => componentProps.navigationProps),
      inputProps,
      elementProps,
    ],
  });
}

export interface FilterDropdownInputState {
  /**
   * Whether the input shows its focus ring.
   * Cleared when keyboard navigation highlights an item.
   */
  highlighted: boolean;
}

export interface FilterDropdownInputProps extends BaseUIComponentProps<
  'input',
  FilterDropdownInputState
> {}

export interface FilterDropdownInputHostProps extends FilterDropdownInputProps {
  /**
   * The id of the item the host highlights, which the input points at while it holds focus.
   */
  activeItemId?: string | undefined;
  /**
   * The host's list navigation props. The host routes key presses itself, so these exclude a
   * key handler.
   */
  navigationProps?: HTMLProps | undefined;
}

export namespace FilterDropdownInput {
  export type Props = FilterDropdownInputProps;
  export type State = FilterDropdownInputState;
}
