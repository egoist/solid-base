import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { valueToPercent } from '../../utils/valueToPercent';
import { createIsHydrating } from '../../utils/createIsHydrating';
import { renderElement } from '../../internals/renderElement';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import type { SliderRootState } from '../root/SliderRoot';

function getIndicatorStyles(
  vertical: boolean,
  range: boolean,
  inset: boolean,
  start: number | undefined,
  end: number | undefined,
  forceHidden: boolean,
): JSX.CSSProperties {
  const styles: JSX.CSSProperties = {
    visibility:
      forceHidden || (inset && (start === undefined || (range && end === undefined)))
        ? 'hidden'
        : undefined,
    position: vertical ? 'absolute' : 'relative',
    [vertical ? 'width' : 'height']: 'inherit',
  };

  let startValue: string = `${start ?? 0}%`;
  let sizeValue: string = `${(end ?? 0) - (start ?? 0)}%`;

  if (inset) {
    styles['--start-position'] = startValue;
    startValue = 'var(--start-position)';

    if (range) {
      styles['--relative-size'] = sizeValue;
      sizeValue = 'var(--relative-size)';
    }
  }

  styles[vertical ? 'bottom' : 'inset-inline-start'] = range ? startValue : '0';
  styles[vertical ? 'height' : 'width'] = range ? sizeValue : startValue;

  return styles;
}

/**
 * Visualizes the current value of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderIndicator(componentProps: SliderIndicator.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const context = useSliderRootContext();
  const isHydrating = createIsHydrating();

  const indicatorProps: HTMLProps = {
    get 'data-base-ui-slider-indicator'() {
      return context.renderBeforeHydration ? '' : undefined;
    },
    get style() {
      const { inset, min, max, values, indicatorPosition } = context;
      return getIndicatorStyles(
        context.orientation === 'vertical',
        values.length > 1,
        inset,
        inset ? indicatorPosition[0] : valueToPercent(values[0], min, max),
        inset ? indicatorPosition[1] : valueToPercent(values[values.length - 1], min, max),
        inset && context.renderBeforeHydration && isHydrating(),
      );
    },
  };

  return renderElement('div', componentProps, {
    state: context.state,
    props: [indicatorProps, elementProps],
    stateAttributesMapping: sliderStateAttributesMapping,
  });
}

export interface SliderIndicatorState extends SliderRootState {}

export interface SliderIndicatorProps extends BaseUIComponentProps<'div', SliderIndicatorState> {}

export namespace SliderIndicator {
  export type State = SliderIndicatorState;
  export type Props = SliderIndicatorProps;
}
