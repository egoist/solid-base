import { omit } from 'solid-js';
import type { Orientation } from '../../internals/types';
import { Separator, type SeparatorState } from '../../separator';
import { useToolbarRootContext } from '../root/ToolbarRootContext';

/**
 * A separator element accessible to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Toolbar](https://base.egoist.dev/components/toolbar)
 */
export function ToolbarSeparator(props: ToolbarSeparator.Props) {
  const context = useToolbarRootContext();
  const otherProps = omit(props, 'orientation');

  return (
    <Separator
      orientation={
        props.orientation ?? (context.orientation === 'vertical' ? 'horizontal' : 'vertical')
      }
      {...otherProps}
    />
  );
}

export interface ToolbarSeparatorState extends SeparatorState {}

export interface ToolbarSeparatorProps extends Separator.Props {
  /**
   * The orientation of the separator. Defaults to the opposite of the toolbar's
   * orientation, so a horizontal toolbar renders vertical separators.
   */
  orientation?: Orientation | undefined;
}

export namespace ToolbarSeparator {
  export type State = ToolbarSeparatorState;
  export type Props = ToolbarSeparatorProps;
}
