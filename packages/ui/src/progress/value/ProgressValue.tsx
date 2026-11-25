import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { formatRangeValue } from '../../utils/formatRangeValue';
import { createFormatLocale } from '../utils/createFormatLocale';
import { useProgressRootContext } from '../root/ProgressRootContext';
import type { ProgressRootState } from '../root/ProgressRoot';
import { progressStateAttributesMapping } from '../root/stateAttributesMapping';

/**
 * A text element displaying the current value.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export function ProgressValue(componentProps: ProgressValue.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children');

  const context = useProgressRootContext();
  // Resolved here rather than in Root, since this part can hydrate later, e.g. inside `Loading`.
  const formatLocale = createFormatLocale(() => context.locale);
  const formattedValue = () =>
    formatRangeValue(
      context.clampedValue,
      context.percentageValue,
      formatLocale(),
      context.format,
    );

  // Follow `status` rather than re-deriving it: a non-finite `value` is also indeterminate, and
  // has no formatted text to show.
  const indeterminate = () => context.state.status === 'indeterminate';

  return renderElement('span', componentProps, {
    state: context.state,
    props: [
      {
        'aria-hidden': 'true',
        get children(): JSX.Element {
          const children = componentProps.children;
          if (typeof children === 'function') {
            return children(indeterminate() ? 'indeterminate' : formattedValue(), context.value);
          }
          return indeterminate() ? null : formattedValue();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: progressStateAttributesMapping,
  });
}

export interface ProgressValueState extends ProgressRootState {}

export interface ProgressValueProps extends Omit<
  BaseUIComponentProps<'span', ProgressValueState>,
  'children'
> {
  children?:
    | null
    | ((formattedValue: string | null, value: number | null) => JSX.Element)
    | undefined;
}

export namespace ProgressValue {
  export type State = ProgressValueState;
  export type Props = ProgressValueProps;
}
