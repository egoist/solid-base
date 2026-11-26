import { createMemo, createSignal, omit } from 'solid-js';
import { visuallyHidden } from '@egoist/solid-base-utils/visuallyHidden';
import { clamp } from '@egoist/solid-base-utils/clamp';
import { formatRangeValue } from '../../utils/formatRangeValue';
import { valueToPercent } from '../../utils/valueToPercent';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { createFormatLocale } from '../../utils/createFormatLocale';
import { ProgressRootContext } from './ProgressRootContext';
import { progressStateAttributesMapping } from './stateAttributesMapping';

interface ProgressValues {
  status: ProgressStatus;
  percentageValue: number | null;
  clampedValue: number | null;
}

/**
 * Groups all parts of the progress bar and provides the task completion status to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Progress](https://base.egoist.dev/components/progress)
 */
export function ProgressRoot(componentProps: ProgressRoot.Props) {
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

  // `value === null` (or any non-finite value) keeps Progress indeterminate. Otherwise compute a
  // single clamped value and normalized percentage so completion status, `aria-valuenow`, the
  // formatted text, the default `aria-valuetext`, and the indicator width all stay in sync for any
  // `min`/`max` (not just the default 0–100).
  const values = createMemo<ProgressValues>(() => {
    const value = componentProps.value;
    if (value == null || !Number.isFinite(value)) {
      return { status: 'indeterminate', percentageValue: null, clampedValue: null };
    }
    const rawPercentage = valueToPercent(value, min(), max());
    const clampedValue = clamp(value, min(), max());
    return {
      status: clampedValue === max() ? 'complete' : 'progressing',
      percentageValue: clamp(Number.isNaN(rawPercentage) ? 0 : rawPercentage, 0, 100),
      clampedValue,
    };
  });

  // Format the clamped value so visible and accessible text stay in sync with `aria-valuenow` and
  // the indicator fill. The raw value remains available as the second `getAriaValueText` argument.
  const formattedValue = () =>
    formatRangeValue(
      values().clampedValue,
      values().percentageValue,
      formatLocale(),
      componentProps.format,
    );

  const state: ProgressRootState = {
    get status() {
      return values().status;
    },
  };

  const defaultProps: HTMLProps = {
    role: 'progressbar',
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
      return values().clampedValue ?? undefined;
    },
    get 'aria-valuetext'() {
      const formatted = formattedValue();
      if (componentProps.getAriaValueText) {
        return componentProps.getAriaValueText(formatted, componentProps.value);
      }
      return values().status === 'indeterminate' ? 'indeterminate progress' : formatted;
    },
  };

  const contextValue: ProgressRootContext = {
    get clampedValue() {
      return values().clampedValue;
    },
    get format() {
      return componentProps.format;
    },
    get locale() {
      return componentProps.locale;
    },
    get percentageValue() {
      return values().percentageValue;
    },
    get value() {
      return componentProps.value;
    },
    setLabelId(updater) {
      setLabelId(updater);
    },
    state,
  };

  return (
    <ProgressRootContext value={contextValue}>
      {renderElement('div', componentProps, {
        state,
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
        stateAttributesMapping: progressStateAttributesMapping,
      })}
    </ProgressRootContext>
  );
}

export type ProgressStatus = 'indeterminate' | 'progressing' | 'complete';

export interface ProgressRootState {
  /**
   * The current status.
   */
  status: ProgressStatus;
}

export interface ProgressRootProps extends BaseUIComponentProps<'div', ProgressRootState> {
  /**
   * A string value that provides a user-friendly name for `aria-valuenow`, the current value of the progress bar.
   */
  'aria-valuetext'?: string | undefined;
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * Accepts a function which returns a string value that provides a human-readable text alternative for the current value of the progress bar.
   */
  getAriaValueText?: ((formattedValue: string, value: number | null) => string) | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   * When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum value.
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum value.
   * @default 0
   */
  min?: number | undefined;
  /**
   * The current value. The component is indeterminate when value is `null`.
   */
  value: number | null;
}

export namespace ProgressRoot {
  export type State = ProgressRootState;
  export type Props = ProgressRootProps;
}
