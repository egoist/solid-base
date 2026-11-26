import { untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useComboboxInputValueContext } from '../../combobox/root/ComboboxRootContext';

/**
 * The current value of the autocomplete.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Solid Base Autocomplete](https://base.egoist.dev/components/autocomplete)
 */
export function AutocompleteValue(props: AutocompleteValue.Props): JSX.Element {
  const inputValue = useComboboxInputValueContext();
  const children = untrack(() => props.children);

  return (
    <>
      {(() => {
        // Solid passes some JSX children as zero-argument thunks: only a function taking the
        // value is a render function.
        if (typeof children === 'function' && children.length > 0) {
          return (children as (value: string) => JSX.Element)(String(inputValue() ?? ''));
        }
        if (children != null) {
          return children;
        }
        return inputValue();
      })()}
    </>
  );
}

export interface AutocompleteValueState {}

export interface AutocompleteValueProps {
  /**
   * The content, or a function receiving the current input value. The function re-runs when the
   * value changes.
   */
  children?: JSX.Element | ((value: string) => JSX.Element);
}

export namespace AutocompleteValue {
  export type State = AutocompleteValueState;
  export type Props = AutocompleteValueProps;
}
