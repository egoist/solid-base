import { createEffect, createSignal, flush, omit, onCleanup, untrack } from 'solid-js';
import { isServer, type JSX } from '@solidjs/web';
import { visuallyHidden } from '@egoist/solid-base-utils/visuallyHidden';
import { ownerWindow } from '@egoist/solid-base-utils/owner';
import { clamp } from '@egoist/solid-base-utils/clamp';
import { formatNumber } from '@egoist/solid-base-utils/formatNumber';
import { contains } from '@egoist/solid-base-utils/shadowDom';
import { applyRef, type RefProp } from '@egoist/solid-base-utils/refs';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { mergeProps } from '../../merge-props/mergeProps';
import { createBaseUiId } from '../../internals/baseUiId';
import { createIsHydrating } from '../../utils/createIsHydrating';
import { createFormatLocale } from '../../utils/createFormatLocale';
import { renderElement } from '../../internals/renderElement';
import { valueToPercent } from '../../utils/valueToPercent';
import {
  ARROW_DOWN,
  ARROW_UP,
  ARROW_RIGHT,
  ARROW_LEFT,
  HOME,
  END,
  COMPOSITE_KEYS,
  PAGE_UP,
  PAGE_DOWN,
} from '../../internals/composite/composite';
import { useCompositeListItem } from '../../internals/composite';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useCSPContext } from '../../internals/csp-context/CSPContext';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { createSetFieldFocused } from '../../internals/field-root-context/createSetFieldFocused';
import { matchesFocusVisible } from '../../utils/popups/element';
import { createLabelableId } from '../../internals/labelable-provider/createLabelableId';
import { getMidpoint } from '../utils/getMidpoint';
import { getSliderValue } from '../utils/getSliderValue';
import { getDecimalPrecision, roundValueToStep } from '../utils/roundValueToStep';
import type { SliderRootState } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import * as SliderThumbDataAttributes from './SliderThumbDataAttributes';
import { script as prehydrationScript } from './prehydrationScript.min';

const EMPTY_COMPONENT_PROPS = {};

const SLIDER_STATE_KEYS: readonly (keyof SliderRootState)[] = [
  'disabled',
  'touched',
  'dirty',
  'valid',
  'filled',
  'focused',
  'activeThumbIndex',
  'dragging',
  'max',
  'min',
  'minStepsBetweenValues',
  'orientation',
  'step',
  'values',
];

const ALL_KEYS = new Set([...COMPOSITE_KEYS, PAGE_UP, PAGE_DOWN]);

function getDefaultAriaValueText(
  values: readonly number[],
  index: number,
  format: Intl.NumberFormatOptions | undefined,
  locale: Intl.LocalesArgument | undefined,
): string | undefined {
  if (index < 0) {
    return undefined;
  }

  if (values.length === 2) {
    return `${formatNumber(values[index], locale, format)} ${index === 0 ? 'start' : 'end'} range`;
  }

  return format ? formatNumber(values[index], locale, format) : undefined;
}

function getNewValue(
  thumbValue: number,
  increment: number,
  direction: number,
  min: number,
  max: number,
): number {
  const value = thumbValue + increment * direction;
  const roundedValue = Number(
    value.toFixed(
      Math.max(
        getDecimalPrecision(thumbValue),
        getDecimalPrecision(increment),
        getDecimalPrecision(min),
      ),
    ),
  );
  return clamp(roundedValue, min, max);
}

/**
 * The draggable part of the slider at the tip of the indicator.
 * Renders a `<div>` element and a nested `<input type="range">`.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderThumb(componentProps: SliderThumb.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'children',
    'aria-describedby',
    'aria-label',
    'aria-labelledby',
    'aria-valuetext',
    'disabled',
    'getAriaLabel',
    'getAriaValueText',
    'id',
    'index',
    'inputRef',
    'onBlur',
    'onFocus',
    'onKeyDown',
    'tabindex',
  );

  const id = createBaseUiId(() => componentProps.id || undefined);

  const context = useSliderRootContext();
  const { controlRef, validation, pressedThumbCenterOffsetRef, pressedThumbIndexRef, thumbRefs } =
    context;
  // Resolved here rather than in Root, since this part can hydrate later, e.g. inside Loading.
  const formatLocale = createFormatLocale(() => context.locale);
  const csp = useCSPContext();

  const direction = useDirection();

  const disabled = () => (componentProps.disabled ?? false) || context.disabled;
  const range = () => context.values.length > 1;
  const vertical = () => context.orientation === 'vertical';
  const rtl = () => direction() === 'rtl';

  const field = useFieldRootContext();

  let thumbElement: HTMLElement | null = null;
  let unregisterThumb: (() => void) | undefined;
  onCleanup(() => unregisterThumb?.());
  let inputElement: HTMLInputElement | null = null;
  const setFocused = createSetFieldFocused(disabled, () => inputElement);
  let restoringFocusVisible = false;

  // Attached to the `input` (not the thumb wrapper) so `event.currentTarget` is the
  // input, matching `onKeyDown`. The synthetic blur/focus dispatched while restoring
  // `:focus-visible` is internal and must not be forwarded to the user's handlers.
  const userHandlers: HTMLProps = {
    onFocus(event: FocusEvent) {
      if (restoringFocusVisible) {
        return;
      }
      callHandler(componentProps.onFocus, event);
    },
    onBlur(event: FocusEvent) {
      if (restoringFocusVisible) {
        return;
      }
      callHandler(componentProps.onBlur, event);
    },
    onKeyDown(event: KeyboardEvent) {
      callHandler(componentProps.onKeyDown, event);
    },
  };

  const defaultInputId = createBaseUiId();
  const labelableId = createLabelableId();
  const inputId = () => (range() ? defaultInputId() : labelableId());

  const thumbMetadata: ThumbMetadata = {
    get inputId() {
      return inputId();
    },
  };

  const listItem = useCompositeListItem<ThumbMetadata>({ metadata: thumbMetadata });

  const index = () => (!range() ? 0 : (componentProps.index ?? listItem.index()));
  const last = () => index() === context.values.length - 1;
  const thumbValue = () => context.values[index()];
  const thumbValuePercent = () => valueToPercent(thumbValue(), context.min, context.max);

  const [positionPercent, setPositionPercent] = createSignal<number | undefined>(undefined);
  const isHydrating = createIsHydrating();

  const safeLastUsedThumbIndex = () => {
    const lastUsed = context.lastUsedThumbIndex;
    return lastUsed >= 0 && lastUsed < context.values.length ? lastUsed : -1;
  };

  // The last position and indicator edge applied, including updates that haven't flushed yet.
  let appliedInset: [number | undefined, number] = [undefined, -1];

  // Imperative: runs from effects and observers, reads the state at call time.
  function getInsetPosition(sync?: boolean) {
    const control = controlRef.current;
    const thumb = thumbElement;
    if (!control || !thumb) {
      return;
    }

    const thumbRect = thumb.getBoundingClientRect();
    const controlRect = control.getBoundingClientRect();

    const side = untrack(vertical) ? 'height' : 'width';

    // A hidden control measures 0, so keep the last position until it can be measured again.
    if (!controlRect[side]) {
      return;
    }

    // the total travel distance adjusted to account for the thumb size
    const controlSize = controlRect[side] - thumbRect[side];
    // px distance from the starting edge (inline-start or bottom) to the thumb center
    const thumbOffsetFromControlEdge =
      thumbRect[side] / 2 + (controlSize * untrack(thumbValuePercent)) / 100;
    const nextPositionPercent = (thumbOffsetFromControlEdge / controlRect[side]) * 100;
    // `min === max` has no valid position, which hides the thumb.
    const nextInsetPosition = Number.isFinite(nextPositionPercent)
      ? nextPositionPercent
      : undefined;

    // The indicator edge this thumb drives: 0 = start, 1 = end, -1 = none.
    let indicatorEdge = -1;
    if (untrack(index) === 0) {
      indicatorEdge = 0;
    } else if (untrack(last)) {
      indicatorEdge = 1;
    }

    const [appliedPosition, appliedEdge] = appliedInset;
    if (nextInsetPosition === appliedPosition && indicatorEdge === appliedEdge) {
      return;
    }

    appliedInset = [nextInsetPosition, indicatorEdge];

    setPositionPercent(nextInsetPosition);

    if (indicatorEdge === 0) {
      context.setIndicatorPosition((prevPosition) => [nextInsetPosition, prevPosition[1]]);
    } else if (indicatorEdge === 1) {
      context.setIndicatorPosition((prevPosition) => [prevPosition[0], nextInsetPosition]);
    }

    if (sync) {
      flush();
    }
  }

  // `index` and `last` decide which indicator edge this thumb drives.
  createEffect(
    () => [context.inset, thumbValuePercent(), index(), last()] as const,
    ([inset]) => {
      if (inset) {
        getInsetPosition();
      }
    },
  );

  createEffect(
    () => context.inset,
    (inset) => {
      if (!inset) {
        return undefined;
      }

      let resizeObserver: ResizeObserver | undefined;
      let cancelled = false;

      // The control's ref attaches after this descendant's setup runs.
      queueMicrotask(() => {
        const control = controlRef.current;
        const thumb = thumbElement;

        if (cancelled || !control || !thumb) {
          return;
        }

        const ResizeObserverCtor = ownerWindow(control).ResizeObserver;
        if (typeof ResizeObserverCtor === 'function') {
          // Observer callbacks run before paint; flush so a resize never paints a stale position.
          resizeObserver = new ResizeObserverCtor(() => getInsetPosition(true));
          resizeObserver.observe(control);
          resizeObserver.observe(thumb);
        }

        // Still before the first paint, so flush to avoid a frame with the thumb hidden.
        getInsetPosition(true);
      });

      return () => {
        cancelled = true;
        resizeObserver?.disconnect();
      };
    },
  );

  const thumbStyle = (): JSX.CSSProperties => {
    const inset = context.inset;
    const percent = thumbValuePercent();
    if (!inset && !Number.isFinite(percent)) {
      return visuallyHidden;
    }

    const isVertical = vertical();
    const startEdge = isVertical ? 'bottom' : 'inset-inline-start';
    const crossOffsetProperty = isVertical ? 'left' : 'top';

    let zIndex: number | undefined;
    const activeIndex = context.active;
    const currentIndex = index();
    if (range()) {
      if (activeIndex === currentIndex) {
        zIndex = 2;
      } else if (safeLastUsedThumbIndex() === currentIndex) {
        zIndex = 1;
      }
    } else if (activeIndex === currentIndex) {
      zIndex = 1;
    }

    const style: JSX.CSSProperties = {
      position: 'absolute',
      [startEdge]: inset ? 'var(--position)' : `${percent}%`,
      [crossOffsetProperty]: '50%',
      translate: `${(isVertical || !rtl() ? -1 : 1) * 50}% ${(isVertical ? 1 : -1) * 50}%`,
      'z-index': zIndex === undefined ? undefined : String(zIndex),
    };

    if (inset) {
      const position = positionPercent();
      style['--position'] = `${position ?? 0}%`;
      style.visibility =
        (context.renderBeforeHydration && isHydrating()) || position === undefined
          ? 'hidden'
          : undefined;
    }

    return style;
  };

  const ariaLabel = () =>
    typeof componentProps.getAriaLabel === 'function'
      ? componentProps.getAriaLabel(index())
      : componentProps['aria-label'];

  function handleValueInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const applied = context.handleInputChange(input.valueAsNumber, index(), event);
    // Like a controlled React input, revert a rejected value (canceled, unchanged or out of
    // bounds): the reactive `value` binding doesn't re-run when the state stays the same.
    if (!applied) {
      const current = thumbValue();
      input.value = current == null ? '' : String(current);
    }
  }

  const internalInputProps: HTMLProps = {
    type: 'range',
    get min() {
      return context.min;
    },
    get max() {
      return context.max;
    },
    get step() {
      return context.step;
    },
    get value() {
      return thumbValue() ?? '';
    },
    get 'aria-label'() {
      return ariaLabel();
    },
    get 'aria-labelledby'() {
      return (
        componentProps['aria-labelledby'] ?? (ariaLabel() == null ? context.labelId : undefined)
      );
    },
    get 'aria-describedby'() {
      return componentProps['aria-describedby'];
    },
    get 'aria-orientation'() {
      return context.orientation;
    },
    get 'aria-valuenow'() {
      return thumbValue();
    },
    get 'aria-valuetext'() {
      if (typeof componentProps.getAriaValueText === 'function') {
        return componentProps.getAriaValueText(
          formatNumber(thumbValue(), formatLocale(), context.format),
          thumbValue(),
          index(),
        );
      }
      return (
        componentProps['aria-valuetext'] ??
        getDefaultAriaValueText(context.values, index(), context.format, formatLocale())
      );
    },
    get disabled() {
      return disabled();
    },
    get form() {
      return context.form;
    },
    get id() {
      return inputId();
    },
    get name() {
      return context.name;
    },
    // Browsers fire `input` while the value changes and `change` when it's committed; React's
    // `onChange` listens to both. An already applied value is ignored the second time.
    onInput: handleValueInput,
    onChange: handleValueInput,
    onFocus(event: FocusEvent) {
      const isRestoringFocusVisible = restoringFocusVisible;
      restoringFocusVisible = false;
      context.setActive(index());
      setFocused(true);

      if (isRestoringFocusVisible) {
        event.stopPropagation();
      }
    },
    onBlur(event: FocusEvent) {
      if (restoringFocusVisible) {
        event.stopPropagation();
        return;
      }

      context.setActive(-1);

      // Keep field-level blur logic from running while focus moves to another thumb
      // of the same slider, so validation doesn't commit mid-interaction.
      if (
        thumbRefs.current.some((thumb) => contains(thumb, event.relatedTarget as Element | null))
      ) {
        return;
      }

      field.setTouched(true);
      setFocused(false);

      if (field.validationMode() === 'onBlur') {
        validation.commit(
          getSliderValue(
            thumbValue(),
            index(),
            context.min,
            context.max,
            context.isArrayValue,
            context.values,
          ),
        );
      }
    },
    onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return;
      }

      if (!ALL_KEYS.has(event.key)) {
        return;
      }

      if (COMPOSITE_KEYS.has(event.key)) {
        event.stopPropagation();
      }

      const { min, max, step, largeStep, minStepsBetweenValues, values } = context;
      const currentIndex = index();
      const currentValue = thumbValue();
      const isRange = values.length > 1;

      let newValue: number | null = null;
      let keyDirection = 0;
      let increment = event.shiftKey ? largeStep : step;
      const roundedValue = roundValueToStep(currentValue, step, min);
      switch (event.key) {
        case ARROW_UP:
          keyDirection = 1;
          break;
        case ARROW_RIGHT:
          keyDirection = rtl() ? -1 : 1;
          break;
        case ARROW_DOWN:
          keyDirection = -1;
          break;
        case ARROW_LEFT:
          keyDirection = rtl() ? 1 : -1;
          break;
        case PAGE_UP:
          increment = largeStep;
          keyDirection = 1;
          break;
        case PAGE_DOWN:
          increment = largeStep;
          keyDirection = -1;
          break;
        case END:
          newValue =
            isRange && Number.isFinite(values[currentIndex + 1])
              ? values[currentIndex + 1] - step * minStepsBetweenValues
              : max;
          break;
        case HOME:
          newValue =
            isRange && Number.isFinite(values[currentIndex - 1])
              ? values[currentIndex - 1] + step * minStepsBetweenValues
              : min;
          break;
        default:
          break;
      }

      if (keyDirection !== 0) {
        newValue = getNewValue(roundedValue, increment, keyDirection, min, max);
      }

      if (newValue !== null) {
        const input = event.currentTarget as HTMLInputElement;

        if (!matchesFocusVisible(input)) {
          restoringFocusVisible = true;
          input.blur();
          input.focus({
            preventScroll: true,
            // Show `:focus-visible` after keyboard interaction, even if the
            // thumb was previously focused by a pointer.
            focusVisible: true,
          } as FocusOptions);
        }

        context.handleInputChange(newValue, currentIndex, event);
        event.preventDefault();
      }
    },
    get style(): JSX.CSSProperties {
      return {
        ...visuallyHidden,
        // So that VoiceOver's focus indicator matches the thumb's dimensions
        width: '100%',
        height: '100%',
        'writing-mode': vertical() ? (rtl() ? 'vertical-rl' : 'vertical-lr') : undefined,
      };
    },
    get tabindex() {
      return componentProps.tabindex;
    },
  };

  const inputProps = mergeProps<HTMLProps>(
    internalInputProps,
    (props: HTMLProps) => validation.getValidationProps(disabled, props),
    userHandlers,
  );

  const inputRef = (element: HTMLInputElement) => {
    inputElement = element;
    validation.inputRef.current = element;
  };

  const thumbProps: HTMLProps = {
    get [SliderThumbDataAttributes.index]() {
      return index();
    },
    get id() {
      return id();
    },
    onPointerDown(event: PointerEvent) {
      // Keep disabled thumbs from writing transient pointer state.
      if (disabled()) {
        return;
      }

      const currentTarget = event.currentTarget as HTMLElement;
      pressedThumbIndexRef.current = index();
      const midpoint = getMidpoint(currentTarget, vertical());
      pressedThumbCenterOffsetRef.current = (vertical() ? event.clientY : event.clientX) - midpoint;
    },
    get style() {
      return thumbStyle();
    },
    children: (
      <>
        {componentProps.children}
        {renderElement('input', EMPTY_COMPONENT_PROPS, {
          ref: [inputRef, (element: HTMLInputElement) => applyRef(componentProps.inputRef, element)],
          props: inputProps,
        })}
        {/* Rendered with the last thumb to ensure all preceding thumbs are already in the DOM.
            Only emitted on the server: the client never renders it. */}
        {isServer && context.inset && last() && context.renderBeforeHydration ? (
          <script nonce={csp.nonce} innerHTML={prehydrationScript} />
        ) : null}
      </>
    ),
  };

  // The root state, with the thumb's own `disabled`. Every key forwards to the root state lazily.
  const state = {} as SliderThumbState;
  for (const key of SLIDER_STATE_KEYS) {
    Object.defineProperty(state, key, {
      enumerable: true,
      get: key === 'disabled' ? disabled : () => context.state[key],
    });
  }

  return renderElement('div', componentProps, {
    state,
    ref: [
      listItem.ref,
      (element: HTMLElement) => {
        if (thumbElement === element) {
          return;
        }
        unregisterThumb?.();
        thumbElement = element;
        unregisterThumb = context.registerThumb(element);
      },
    ],
    props: [thumbProps, elementProps],
    stateAttributesMapping: sliderStateAttributesMapping,
  });
}

function callHandler<E extends Event>(
  handler: JSX.EventHandlerUnion<HTMLInputElement, E> | undefined,
  event: E,
) {
  if (typeof handler === 'function') {
    (handler as (event: E) => void)(event);
  } else if (Array.isArray(handler)) {
    (handler[0] as (data: unknown, event: E) => void)(handler[1], event);
  }
}

export interface ThumbMetadata {
  inputId: string | undefined;
}

export interface SliderThumbState extends SliderRootState {}

export interface SliderThumbProps extends Omit<
  BaseUIComponentProps<'div', SliderThumbState>,
  'onBlur' | 'onFocus' | 'onKeyDown' | 'tabindex'
> {
  /**
   * Whether the thumb should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A string value forwarded to the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the `input`.
   * Ignored when `getAriaValueText` is provided.
   */
  'aria-valuetext'?: string | undefined;
  /**
   * A function which returns a string value for the [`aria-label`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label) attribute of the `input`.
   */
  getAriaLabel?: ((index: number) => string) | null | undefined;
  /**
   * A function which returns a string value for the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the `input`.
   * This is important for screen reader users.
   */
  getAriaValueText?:
    | ((formattedValue: string, value: number, index: number) => string)
    | null
    | undefined;
  /**
   * The index of the thumb which corresponds to the index of its value in the
   * `value` or `defaultValue` array.
   * This prop is required to support server-side rendering for range sliders
   * with multiple thumbs.
   * @example
   * ```tsx
   * <Slider.Root value={[10, 20]}>
   *   <Slider.Thumb index={0} />
   *   <Slider.Thumb index={1} />
   * </Slider.Root>
   * ```
   */
  index?: number | undefined;
  /**
   * A ref to access the nested input element.
   */
  inputRef?: RefProp<HTMLInputElement>;
  /**
   * A blur handler forwarded to the `input`.
   */
  onBlur?: JSX.EventHandlerUnion<HTMLInputElement, FocusEvent> | undefined;
  /**
   * A focus handler forwarded to the `input`.
   */
  onFocus?: JSX.EventHandlerUnion<HTMLInputElement, FocusEvent> | undefined;
  /**
   * A keydown handler forwarded to the `input`.
   */
  onKeyDown?: JSX.EventHandlerUnion<HTMLInputElement, KeyboardEvent> | undefined;
  /**
   * Optional tab index attribute forwarded to the `input`.
   */
  tabindex?: number | undefined;
}

export namespace SliderThumb {
  export type State = SliderThumbState;
  export type Props = SliderThumbProps;
}
