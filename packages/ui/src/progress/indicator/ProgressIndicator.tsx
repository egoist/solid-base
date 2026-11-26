import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { ProgressRootState } from '../root/ProgressRoot';
import { useProgressRootContext } from '../root/ProgressRootContext';
import { progressStateAttributesMapping } from '../root/stateAttributesMapping';

/**
 * Visualizes the completion status of the task.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Progress](https://base.egoist.dev/components/progress)
 */
export function ProgressIndicator(componentProps: ProgressIndicator.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const context = useProgressRootContext();

  return renderElement('div', componentProps, {
    state: context.state,
    props: [
      {
        get style(): JSX.CSSProperties | undefined {
          const percentageValue = context.percentageValue;
          if (percentageValue == null) {
            return undefined;
          }
          return {
            'inset-inline-start': '0px',
            height: 'inherit',
            width: `${percentageValue}%`,
          };
        },
      },
      elementProps,
    ],
    stateAttributesMapping: progressStateAttributesMapping,
  });
}

export interface ProgressIndicatorState extends ProgressRootState {}

export interface ProgressIndicatorProps extends BaseUIComponentProps<
  'div',
  ProgressIndicatorState
> {}

export namespace ProgressIndicator {
  export type State = ProgressIndicatorState;
  export type Props = ProgressIndicatorProps;
}
