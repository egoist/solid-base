import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, Orientation } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';

/**
 * A visual separator between items.
 * Renders a `<div>` element.
 *
 * @internal
 */
export function ListboxSeparator(componentProps: ListboxSeparator.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'orientation');

  const state: ListboxSeparatorState = {
    get orientation() {
      return componentProps.orientation ?? 'horizontal';
    },
  };

  return renderElement('div', componentProps, {
    state,
    props: [{ role: 'presentation' }, elementProps],
  });
}

export interface ListboxSeparatorProps extends BaseUIComponentProps<'div', ListboxSeparatorState> {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}

export interface ListboxSeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Orientation;
}

export namespace ListboxSeparator {
  export type Props = ListboxSeparatorProps;
  export type State = ListboxSeparatorState;
}
