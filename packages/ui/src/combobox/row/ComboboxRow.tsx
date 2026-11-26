import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { ComboboxRowContext } from './ComboboxRowContext';

/**
 * Displays a single row of items in a grid list.
 * Enable `grid` on the root component to turn the listbox into a grid.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Combobox](https://base.egoist.dev/components/combobox)
 */
export function ComboboxRow(componentProps: ComboboxRow.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  // Created inside the provider: the children read it.
  const Element = () =>
    renderElement('div', componentProps, {
      props: [{ role: 'row' }, elementProps],
    });

  return (
    <ComboboxRowContext value>
      <Element />
    </ComboboxRowContext>
  );
}

export interface ComboboxRowState {}

export interface ComboboxRowProps extends BaseUIComponentProps<'div', ComboboxRowState> {}

export namespace ComboboxRow {
  export type State = ComboboxRowState;
  export type Props = ComboboxRowProps;
}
