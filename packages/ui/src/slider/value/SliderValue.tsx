import { createMemo, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { formatNumber } from '@egoist/solid-base-utils/formatNumber';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { createFormatLocale } from '../../utils/createFormatLocale';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import type { SliderRootState } from '../root/SliderRoot';

/**
 * Displays the current value of the slider as text.
 * Renders an `<output>` element.
 *
 * Documentation: [Solid Base Slider](https://base.egoist.dev/components/slider)
 */
export function SliderValue(componentProps: SliderValue.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'aria-live');

  const context = useSliderRootContext();
  // Resolved here rather than in Root, since this part can hydrate later, e.g. inside Loading.
  const formatLocale = createFormatLocale(() => context.locale);

  const outputFor = () =>
    Array.from(context.thumbMap.values(), ({ inputId }) => inputId)
      .join(' ')
      .trim() || undefined;

  const formattedValues = createMemo(() =>
    context.values.map((v) => formatNumber(v, formatLocale(), context.format)),
  );

  const children = createMemo(() => {
    const render = componentProps.children;
    if (typeof render === 'function') {
      return render(formattedValues(), context.values);
    }
    return formattedValues().join(' – ');
  });

  const valueProps: HTMLProps = {
    // off by default because it will keep announcing when the slider is being dragged
    // and also when the value is changing (but not yet committed)
    get 'aria-live'() {
      return componentProps['aria-live'] ?? 'off';
    },
    get children() {
      return children();
    },
    get for() {
      return outputFor();
    },
  };

  return renderElement('output', componentProps, {
    state: context.state,
    props: [valueProps, elementProps],
    stateAttributesMapping: sliderStateAttributesMapping,
  });
}

export interface SliderValueState extends SliderRootState {}

export interface SliderValueProps extends Omit<
  BaseUIComponentProps<'output', SliderValueState>,
  'children'
> {
  children?:
    | null
    | ((formattedValues: readonly string[], values: readonly number[]) => JSX.Element)
    | undefined;
}

export namespace SliderValue {
  export type State = SliderValueState;
  export type Props = SliderValueProps;
}
