import { createMemo, createSignal, omit } from 'solid-js';
import { visuallyHidden } from '@egoist/solid-base-utils/visuallyHidden';
import { clamp } from '@egoist/solid-base-utils/clamp';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { formatRangeValue } from '../../utils/formatRangeValue';
import { valueToPercent } from '../../utils/valueToPercent';
import { createFormatLocale } from '../../utils/createFormatLocale';
import { MeterRootContext } from './MeterRootContext';

/**
 * Groups all parts of the meter and provides the value for screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Meter](https://base-ui.com/react/components/meter)
 */
export function MeterRoot(componentProps: MeterRoot.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'format',
    'getAriaValueText',
    'locale',
    'max',
    'min',
    'value',
    'children',
  );

  const min = () => componentProps.min ?? 0;
  const max = () => componentProps.max ?? 100;

  const [labelId, setLabelId] = createSignal<string | undefined>();
  const formatLocale = createFormatLocale(() => componentProps.locale);

  // `clamp` handles infinity, but NaN needs an explicit fallback before normalizing range outputs.
  const percentageValue = createMemo(() => {
    const rawPercentage = valueToPercent(componentProps.value, min(), max());
    return clamp(Number.isNaN(rawPercentage) ? 0 : rawPercentage, 0, 100);
  });
  const clampedValue = createMemo(() => {
    const value = componentProps.value;
    return clamp(Number.isNaN(value) ? min() : value, min(), max());
  });

  // Format the clamped value so visible and accessible text stay in sync with `aria-valuenow` and
  // the indicator fill. The raw value remains available as the second `getAriaValueText` argument.
  const formattedValue = () =>
    formatRangeValue(clampedValue(), percentageValue(), formatLocale(), componentProps.format);

  const defaultProps: HTMLProps = {
    role: 'meter',
    get 'aria-labelledby'() {
      return labelId();
    },
    get 'aria-valuemax'() {
      return max();
    },
    get 'aria-valuemin'() {
      return min();
    },
    get 'aria-valuenow'() {
      return clampedValue();
    },
    get 'aria-valuetext'() {
      const formatted = formattedValue();
      if (componentProps.getAriaValueText) {
        return componentProps.getAriaValueText(formatted, componentProps.value);
      }
      return formatted;
    },
  };

  const contextValue: MeterRootContext = {
    get clampedValue() {
      return clampedValue();
    },
    get format() {
      return componentProps.format;
    },
    get locale() {
      return componentProps.locale;
    },
    get percentageValue() {
      return percentageValue();
    },
    setLabelId(updater) {
      setLabelId(updater);
    },
    get value() {
      return componentProps.value;
    },
  };

  return (
    <MeterRootContext value={contextValue}>
      {renderElement('div', componentProps, {
        props: [
          defaultProps,
          elementProps,
          {
            children: (
              <>
                {componentProps.children}
                <span role="presentation" style={visuallyHidden}>
                  {/* force NVDA to read the label https://github.com/mui/base-ui/issues/4184 */}x
                </span>
              </>
            ),
          },
        ],
      })}
    </MeterRootContext>
  );
}

export interface MeterRootState {}

export interface MeterRootProps extends BaseUIComponentProps<'div', MeterRootState> {
  /**
   * A string value that provides a user-friendly name for `aria-valuenow`, the current value of the meter.
   */
  'aria-valuetext'?: string | undefined;
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * A function that returns a string value that provides a human-readable text alternative for `aria-valuenow`, the current value of the meter.
   */
  getAriaValueText?: ((formattedValue: string, value: number) => string) | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   * When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum value
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum value
   * @default 0
   */
  min?: number | undefined;
  /**
   * The current value.
   */
  value: number;
}

export namespace MeterRoot {
  export type State = MeterRootState;
  export type Props = MeterRootProps;
}
