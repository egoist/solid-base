import type { JSX } from '@solidjs/web';
import { SelectScrollArrow } from '../scroll-arrow/SelectScrollArrow';
import type { BaseUIComponentProps } from '../../internals/types';

/**
 * An element that scrolls the select popup up when hovered. Does not render when using touch input.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Select](https://base.egoist.dev/components/select)
 */
export function SelectScrollUpArrow(props: SelectScrollUpArrow.Props): JSX.Element {
  return <SelectScrollArrow {...(props as SelectScrollArrow.Props)} direction="up" />;
}

export interface SelectScrollUpArrowState {}

export interface SelectScrollUpArrowProps
  extends BaseUIComponentProps<'div', SelectScrollArrow.State> {
  /**
   * Whether to keep the HTML element in the DOM while the select popup is not scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace SelectScrollUpArrow {
  export type State = SelectScrollUpArrowState;
  export type Props = SelectScrollUpArrowProps;
}
