import { omit } from 'solid-js';
import { renderElement } from '../../internals/renderElement';
import { useFieldsetRootContext } from '../root/FieldsetRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { createRegisteredLabelId } from '../../utils/createRegisteredLabelId';

/**
 * An accessible label that is automatically associated with the fieldset.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Fieldset](https://base.egoist.dev/components/fieldset)
 */
export function FieldsetLegend(componentProps: FieldsetLegend.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id');

  const { disabled, setLegendId } = useFieldsetRootContext();

  const id = createRegisteredLabelId(() => componentProps.id, setLegendId);

  const state: FieldsetLegendState = {
    get disabled() {
      return disabled();
    },
  };

  return renderElement('div', componentProps, {
    state,
    props: [
      {
        get id() {
          return id();
        },
      },
      elementProps,
    ],
  });
}

export interface FieldsetLegendState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FieldsetLegendProps
  extends Omit<BaseUIComponentProps<'div', FieldsetLegendState>, 'id'> {
  /**
   * The id of the element. A generated id is used by default.
   */
  id?: string | undefined;
}

export namespace FieldsetLegend {
  export type State = FieldsetLegendState;
  export type Props = FieldsetLegendProps;
}
