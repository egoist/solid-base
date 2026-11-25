import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { useComboboxGroupContext } from '../group/ComboboxGroupContext';
import { createRegisteredLabelId } from '../../utils/createRegisteredLabelId';

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxGroupLabel(componentProps: ComboboxGroupLabel.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id');

  const { setLabelId } = useComboboxGroupContext();

  const id = createRegisteredLabelId(() => componentProps.id as string | undefined, setLabelId);

  return renderElement('div', componentProps, {
    props: [
      {
        get id() {
          return id();
        },
        'aria-hidden': true,
      },
      elementProps,
    ],
  });
}

export interface ComboboxGroupLabelState {}

export interface ComboboxGroupLabelProps extends BaseUIComponentProps<
  'div',
  ComboboxGroupLabelState
> {}

export namespace ComboboxGroupLabel {
  export type State = ComboboxGroupLabelState;
  export type Props = ComboboxGroupLabelProps;
}
