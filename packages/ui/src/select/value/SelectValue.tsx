import { createMemo, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { useSelectRootContext } from '../root/SelectRootContext';
import { resolveMultipleLabels, resolveSelectedLabel } from '../../internals/resolveValueLabel';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';

const stateAttributesMapping: StateAttributesMapping<SelectValueState> = {
  value: () => null,
};

/**
 * A text label of the currently selected item.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectValue(componentProps: SelectValue.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'placeholder');

  const store = useSelectRootContext();

  const value = () => store.select('selectedValue');
  const hasSelectedValue = () => store.select('hasSelectedValue');

  const state: SelectValueState = {
    get value() {
      return value();
    },
    get placeholder() {
      return !hasSelectedValue();
    },
  };

  // Read once per change of the props: reading `children` (or `placeholder`) creates the elements.
  const childrenProp = createMemo(() => componentProps.children);
  const placeholderProp = createMemo(() => componentProps.placeholder);

  function resolveChildren(): JSX.Element {
    const children = childrenProp();
    if (typeof children === 'function') {
      return (children as (value: any) => JSX.Element)(value());
    }
    if (children != null) {
      return children;
    }

    const placeholder = placeholderProp();
    const shouldCheckNullItemLabel = !hasSelectedValue() && placeholder != null;
    if (shouldCheckNullItemLabel && !store.select('hasNullItemLabel', true)) {
      return placeholder;
    }

    const currentValue = value();
    const items = store.select('items');
    const itemToStringLabel = store.select('itemToStringLabel');
    if (Array.isArray(currentValue)) {
      return resolveMultipleLabels(currentValue, items, itemToStringLabel);
    }
    return resolveSelectedLabel(currentValue, items, itemToStringLabel);
  }

  return renderElement('span', componentProps, {
    state,
    ref: (element: HTMLSpanElement) => {
      store.context.valueRef.current = element;
    },
    props: [
      {
        get children() {
          return resolveChildren();
        },
      },
      elementProps,
    ],
    stateAttributesMapping,
  });
}

export interface SelectValueState {
  /**
   * The value of the currently selected item.
   */
  value: any;
  /**
   * Whether the placeholder is being displayed.
   */
  placeholder: boolean;
}

export interface SelectValueProps
  extends Omit<BaseUIComponentProps<'span', SelectValueState>, 'children'> {
  /**
   * Accepts a function that returns an element to format the selected value.
   * Treat the value as read-only: in `multiple` mode it may be a shared frozen array
   * when nothing is selected.
   * @example
   * ```tsx
   * <Select.Value>
   *   {(value: string | null) => value ? labels[value] : 'No value'}
   * </Select.Value>
   * ```
   */
  children?: JSX.Element | ((value: any) => JSX.Element);
  /**
   * The placeholder value to display when no value is selected.
   * This is overridden by `children` if specified, or by a null item's label in `items`.
   */
  placeholder?: JSX.Element;
}

export namespace SelectValue {
  export type State = SelectValueState;
  export type Props = SelectValueProps;
}
