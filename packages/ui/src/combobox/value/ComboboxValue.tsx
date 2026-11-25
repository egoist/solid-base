import { untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { resolveMultipleLabels, resolveSelectedLabel } from '../../internals/resolveValueLabel';

/**
 * The current value of the combobox.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxValue(props: ComboboxValue.Props): JSX.Element {
  const store = useComboboxRootContext();

  // A function child is called with the live selected value; read once.
  const childrenProp = untrack(() => props.children);

  return (
    <>
      {(() => {
        const selectedValue = store.select('selectedValue');
        // Solid passes some JSX children as zero-argument thunks: only a function taking the
        // value is a render function.
        if (typeof childrenProp === 'function' && childrenProp.length > 0) {
          return (childrenProp as (value: any) => JSX.Element)(selectedValue);
        }
        if (childrenProp != null) {
          return childrenProp;
        }

        const itemToStringLabel = store.select('itemToStringLabel');
        const items = store.select('items');
        const multiple = store.select('selectionMode') === 'multiple';
        const hasSelectedValue = store.select('hasSelectedValue');
        const placeholder = props.placeholder;

        const shouldCheckNullItemLabel = !hasSelectedValue && placeholder != null;
        const hasNullLabel = store.select('hasNullItemLabel', shouldCheckNullItemLabel);

        if (!hasSelectedValue && placeholder != null && !hasNullLabel) {
          return placeholder;
        }
        if (multiple && Array.isArray(selectedValue)) {
          return resolveMultipleLabels(selectedValue, items as any, itemToStringLabel);
        }
        return resolveSelectedLabel(selectedValue, items as any, itemToStringLabel);
      })()}
    </>
  );
}

export interface ComboboxValueState {}

export interface ComboboxValueProps {
  /**
   * The value content, or a function receiving the selected value. The function re-runs when
   * the selected value changes.
   */
  children?: JSX.Element | ((selectedValue: any) => JSX.Element);
  /**
   * The placeholder value to display when no value is selected.
   * This is overridden by `children` if specified, or by a null item's label in `items`.
   */
  placeholder?: JSX.Element;
}

export namespace ComboboxValue {
  export type State = ComboboxValueState;
  export type Props = ComboboxValueProps;
}
