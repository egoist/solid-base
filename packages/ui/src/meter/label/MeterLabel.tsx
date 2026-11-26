import { omit } from 'solid-js';
import { useMeterRootContext } from '../root/MeterRootContext';
import type { MeterRootState } from '../root/MeterRoot';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { createRegisteredLabelId } from '../../utils/createRegisteredLabelId';

/**
 * An accessible label for the meter.
 * Renders a `<span>` element.
 *
 * Documentation: [Solid Base Meter](https://base.egoist.dev/components/meter)
 */
export function MeterLabel(componentProps: MeterLabel.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id');

  const { setLabelId } = useMeterRootContext();

  const id = createRegisteredLabelId(
    () => (componentProps.id === false ? undefined : componentProps.id),
    setLabelId,
  );

  return renderElement('span', componentProps, {
    props: [
      {
        get id() {
          return id();
        },
        role: 'presentation',
      },
      elementProps,
    ],
  });
}

export interface MeterLabelState extends MeterRootState {}

export interface MeterLabelProps extends BaseUIComponentProps<'span', MeterLabelState> {}

export namespace MeterLabel {
  export type State = MeterLabelState;
  export type Props = MeterLabelProps;
}
