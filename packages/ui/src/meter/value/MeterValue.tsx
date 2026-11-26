import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { useMeterRootContext } from '../root/MeterRootContext';
import type { MeterRootState } from '../root/MeterRoot';
import { renderElement } from '../../internals/renderElement';
import { formatRangeValue } from '../../utils/formatRangeValue';
import { createFormatLocale } from '../../utils/createFormatLocale';

/**
 * A text element displaying the current value.
 * Renders a `<span>` element.
 *
 * Documentation: [Solid Base Meter](https://base.egoist.dev/components/meter)
 */
export function MeterValue(componentProps: MeterValue.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children');

  const context = useMeterRootContext();
  // Resolved here rather than in Root, since this part can hydrate later, e.g. inside `Loading`.
  const formatLocale = createFormatLocale(() => context.locale);
  const formattedValue = () =>
    formatRangeValue(context.clampedValue, context.percentageValue, formatLocale(), context.format);

  return renderElement('span', componentProps, {
    props: [
      {
        'aria-hidden': 'true',
        get children(): JSX.Element {
          const children = componentProps.children;
          return typeof children === 'function'
            ? children(formattedValue(), context.value)
            : formattedValue();
        },
      },
      elementProps,
    ],
  });
}

export interface MeterValueState extends MeterRootState {}

export interface MeterValueProps extends Omit<
  BaseUIComponentProps<'span', MeterValueState>,
  'children'
> {
  children?: null | ((formattedValue: string, value: number) => JSX.Element) | undefined;
}

export namespace MeterValue {
  export type State = MeterValueState;
  export type Props = MeterValueProps;
}
