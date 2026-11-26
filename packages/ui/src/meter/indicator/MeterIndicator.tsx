import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import type { MeterRootState } from '../root/MeterRoot';
import { useMeterRootContext } from '../root/MeterRootContext';
import { renderElement } from '../../internals/renderElement';

/**
 * Visualizes the position of the value along the range.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Meter](https://base.egoist.dev/components/meter)
 */
export function MeterIndicator(componentProps: MeterIndicator.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const context = useMeterRootContext();

  return renderElement('div', componentProps, {
    props: [
      {
        get style(): JSX.CSSProperties {
          return {
            'inset-inline-start': '0px',
            height: 'inherit',
            width: `${context.percentageValue}%`,
          };
        },
      },
      elementProps,
    ],
  });
}

export interface MeterIndicatorState extends MeterRootState {}

export interface MeterIndicatorProps extends BaseUIComponentProps<'div', MeterIndicatorState> {}

export namespace MeterIndicator {
  export type State = MeterIndicatorState;
  export type Props = MeterIndicatorProps;
}
