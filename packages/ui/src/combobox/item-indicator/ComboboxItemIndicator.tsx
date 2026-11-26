import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { useComboboxItemContext } from '../item/ComboboxItemContext';
import { ItemIndicator } from '../../utils/ItemIndicator';

/**
 * Indicates whether the item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Solid Base Combobox](https://base.egoist.dev/components/combobox)
 */
export function ComboboxItemIndicator(componentProps: ComboboxItemIndicator.Props): JSX.Element {
  const { selected } = useComboboxItemContext();

  return <ItemIndicator {...componentProps} selected={selected()} />;
}

export interface ComboboxItemIndicatorProps extends BaseUIComponentProps<
  'span',
  ComboboxItemIndicatorState
> {
  children?: JSX.Element;
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export interface ComboboxItemIndicatorState {
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace ComboboxItemIndicator {
  export type Props = ComboboxItemIndicatorProps;
  export type State = ComboboxItemIndicatorState;
}
