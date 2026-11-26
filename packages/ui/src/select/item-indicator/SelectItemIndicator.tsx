import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { useSelectItemContext } from '../item/SelectItemContext';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { ItemIndicator } from '../../utils/ItemIndicator';

/**
 * Indicates whether the select item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Solid Base Select](https://base.egoist.dev/components/select)
 */
export function SelectItemIndicator(componentProps: SelectItemIndicator.Props): JSX.Element {
  const item = useSelectItemContext();

  return <ItemIndicator {...componentProps} selected={item.selected} />;
}

export interface SelectItemIndicatorState {
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface SelectItemIndicatorProps
  extends BaseUIComponentProps<'span', SelectItemIndicatorState> {
  children?: JSX.Element;
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   */
  keepMounted?: boolean | undefined;
}

export namespace SelectItemIndicator {
  export type State = SelectItemIndicatorState;
  export type Props = SelectItemIndicatorProps;
}
