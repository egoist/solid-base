import type { JSX } from '@solidjs/web';
import { ListboxSeparator } from '../../utils/listbox-separator/ListboxSeparator';
import type { BaseUIComponentProps, Orientation } from '../../internals/types';

export interface SelectSeparatorProps extends BaseUIComponentProps<'div', SelectSeparatorState> {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}

export interface SelectSeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Orientation;
}

/**
 * A visual separator between items or groups.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Select](https://base.egoist.dev/components/select)
 */
export const SelectSeparator = ListboxSeparator as (props: SelectSeparatorProps) => JSX.Element;

export namespace SelectSeparator {
  export type Props = SelectSeparatorProps;
  export type State = SelectSeparatorState;
}
