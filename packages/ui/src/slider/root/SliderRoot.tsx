import { createEffect, createMemo, createSignal, omit, untrack } from 'solid-js';
import { isDev } from '@solidjs/web';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { createControllableSignal } from '@egoist/solid-base-utils/controlled';
import { warn } from '@egoist/solid-base-utils/warn';
import { clamp } from '@egoist/solid-base-utils/clamp';
import { areArraysEqual } from '@egoist/solid-base-utils/areArraysEqual';
import { activeElement, contains } from '@egoist/solid-base-utils/shadowDom';
import { createRefObject, type RefObject } from '@egoist/solid-base-utils/refObject';
import type { BaseUIComponentProps, HTMLProps, Orientation } from '../../internals/types';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import type {
  BaseUIChangeEventDetails,
  BaseUIGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { createBaseUiId } from '../../internals/baseUiId';
import { renderElement } from '../../internals/renderElement';
import { CompositeList, createCompositeList } from '../../internals/composite';
import type { FieldRootState } from '../../field/root/FieldRoot';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import { createRegisterFieldControl } from '../../internals/field-register-control/createRegisterFieldControl';
import { createFieldValueChanged } from '../../internals/field-register-control/createFieldValueChanged';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { getDefaultLabelId } from '../../utils/resolveAriaLabelledBy';
import { asc } from '../utils/asc';
import { getSliderValue } from '../utils/getSliderValue';
import { validateMinimumDistance } from '../utils/validateMinimumDistance';
import type { ThumbMetadata } from '../thumb/SliderThumb';
import { sliderStateAttributesMapping } from './stateAttributesMapping';
import { SliderRootContext } from './SliderRootContext';
import { REASONS } from '../../internals/reasons';

function areValuesEqual(
  newValue: number | readonly number[],
  oldValue: number | readonly number[] | undefined,
) {
  return (
    newValue === oldValue ||
    (Array.isArray(newValue) && Array.isArray(oldValue) && areArraysEqual(newValue, oldValue))
  );
}

function compareDocumentPosition(a: Node, b: Node) {
  if (a === b) {
    return 0;
  }
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1;
}

function areFieldValuesEqual(
  a: number | readonly number[] | undefined,
  b: number | readonly number[] | undefined,
) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return areArraysEqual(a, b);
  }
  return a === b;
}

/**
 * Groups all parts of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderRoot<Value extends number | readonly number[]>(
  componentProps: SliderRoot.Props<Value>,
) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'aria-labelledby',
    'defaultValue',
    'disabled',
    'id',
    'format',
    'largeStep',
    'locale',
    'max',
    'min',
    'minStepsBetweenValues',
    'form',
    'name',
    'onValueChange',
    'onValueCommitted',
    'orientation',
    'step',
    'thumbCollisionBehavior',
    'thumbAlignment',
    'value',
  );

  const min = () => componentProps.min ?? 0;
  const max = () => componentProps.max ?? 100;
  const step = () => componentProps.step ?? 1;
  const largeStep = () => componentProps.largeStep ?? 10;
  const minStepsBetweenValues = () => componentProps.minStepsBetweenValues ?? 0;
  const orientation = () => componentProps.orientation ?? 'horizontal';
  const thumbAlignment = () => componentProps.thumbAlignment ?? 'center';

  const id = createBaseUiId(() => componentProps.id || undefined);
  const defaultLabelId = () => getDefaultLabelId(id());

  function onValueChange(value: number | number[], details: SliderRoot.ChangeEventDetails) {
    (
      componentProps.onValueChange as
        | ((value: number | number[], details: SliderRoot.ChangeEventDetails) => void)
        | undefined
    )?.(value, details);
  }

  function onValueCommitted(
    value: number | readonly number[],
    details: SliderRoot.CommitEventDetails,
  ) {
    (
      componentProps.onValueCommitted as
        | ((value: number | readonly number[], details: SliderRoot.CommitEventDetails) => void)
        | undefined
    )?.(value, details);
  }

  const form = useFormContext();
  const field = useFieldRootContext();
  const { validation } = field;
  const { labelId: fieldLabelId } = useLabelableContext();
  // `Slider.Label` always takes the root's label id: derive it while a label is mounted.
  const [labelCount, setLabelCount] = createSignal(0, { name: 'labelCount' });
  const labelId = () => (labelCount() > 0 ? defaultLabelId() : undefined);

  const ariaLabelledby = () =>
    (componentProps['aria-labelledby'] as string | undefined) ?? fieldLabelId() ?? labelId();
  const disabled = () => (field.disabled() ?? false) || (componentProps.disabled ?? false);
  const name = () => field.name() ?? componentProps.name;

  // The internal value is potentially unsorted, e.g. to support frozen arrays
  // https://github.com/mui/material-ui/pull/28472
  const [valueUnwrapped, setValueUnwrapped] = createControllableSignal<
    number | readonly number[]
  >({
    value: () => componentProps.value,
    defaultValue: () => componentProps.defaultValue ?? componentProps.min ?? 0,
  });

  const sliderRef = createRefObject<HTMLElement | null>(null);
  const controlRef = createRefObject<HTMLElement | null>(null);
  // The mounted thumbs. Ordered on read (by document position) so that pointer handlers see every
  // thumb right after mount, before the composite list settles its indexes.
  const thumbElements = new Set<HTMLElement>();
  const thumbRefs: RefObject<(HTMLElement | null)[]> = {
    get current() {
      return Array.from(thumbElements).sort(compareDocumentPosition);
    },
    set current(_value) {
      // Read-only: thumbs register through `registerThumb`.
    },
  };

  function registerThumb(element: HTMLElement) {
    thumbElements.add(element);
    return () => {
      thumbElements.delete(element);
    };
  }
  // The px distance between the pointer and the center of a pressed thumb.
  const pressedThumbCenterOffsetRef = createRefObject<number | null>(null);
  // The index of the pressed thumb, or the closest thumb if the `Control` was pressed.
  // This is updated on pointerdown, which is sooner than the `active/activeIndex`
  // state which is updated later when the nested `input` receives focus.
  const pressedThumbIndexRef = createRefObject(-1);
  // The values when the current drag interaction started.
  const pressedValuesRef = createRefObject<readonly number[] | null>(null);
  const lastChangeReasonRef = createRefObject<SliderRoot.ChangeEventReason>(REASONS.none);

  // We can't use the :active browser pseudo-classes.
  // - The active state isn't triggered when clicking on the rail.
  // - The active state isn't transferred when inversing a range slider.
  const [activeState, setActiveState] = createSignal(-1, { name: 'active' });
  // A disabled slider has no active thumb.
  const active = () => (disabled() ? -1 : activeState());
  const [lastUsedThumbIndex, setLastUsedThumbIndex] = createSignal(-1);
  const [dragging, setDragging] = createSignal(false);
  const [indicatorPosition, setIndicatorPosition] = createSignal<
    readonly (number | undefined)[]
  >([undefined, undefined]);

  const thumbList = createCompositeList<ThumbMetadata>();

  function setActive(value: number) {
    setActiveState(value);

    if (value !== -1) {
      setLastUsedThumbIndex(value);
    }
  }

  function registerFieldControlRef(element: HTMLElement | null) {
    if (element) {
      controlRef.current = element;
    }
  }

  const range = () => Array.isArray(valueUnwrapped());

  const values = createMemo<readonly number[]>(
    () => {
      const value = valueUnwrapped();
      if (!Array.isArray(value)) {
        return [clamp(value as number, min(), max())];
      }
      return value.map((v) => clamp(v, min(), max())).sort(asc);
    },
    { equals: (a, b) => areArraysEqual(a, b) },
  );

  const fieldValue = createMemo<number | readonly number[]>(
    () => (range() ? values() : values()[0]),
    { equals: areFieldValuesEqual },
  );

  createRegisterFieldControl({
    controlRef: validation.inputRef,
    id,
    value: fieldValue,
    enabled: () => !disabled(),
    name: () => componentProps.name,
    dirty: () =>
      !areFieldValuesEqual(
        fieldValue(),
        field.validityData().initialValue as number | readonly number[] | undefined,
      ),
  });

  createFieldValueChanged(fieldValue, (value) => {
    form.clearErrors(name());
    validation.change(value);
  });

  function setValue(newValue: number | number[], details: SliderRoot.ChangeEventDetails) {
    if (Number.isNaN(newValue) || areValuesEqual(newValue, untrack(valueUnwrapped))) {
      return false;
    }

    // Redefine target to allow name and value to be read.
    // This allows seamless integration with the most popular form libraries.
    // https://github.com/mui/material-ui/issues/13485#issuecomment-676048492
    // Clone the event to not override `target` of the original event.
    const nativeEvent = details.event;
    const EventConstructor = nativeEvent.constructor as typeof Event;
    const clonedEvent = new EventConstructor(nativeEvent.type, nativeEvent);

    Object.defineProperty(clonedEvent, 'target', {
      writable: true,
      value: { value: newValue, name: untrack(name) },
    });

    details.event = clonedEvent;

    onValueChange(newValue, details);

    if (details.isCanceled) {
      return false;
    }

    lastChangeReasonRef.current = details.reason;

    setValueUnwrapped(newValue);

    return true;
  }

  function handleInputChange(
    valueInput: number,
    index: number,
    event: KeyboardEvent | Event,
  ): boolean {
    const newValue = getSliderValue(
      valueInput,
      index,
      untrack(min),
      untrack(max),
      untrack(range),
      untrack(values),
    );

    if (validateMinimumDistance(newValue, untrack(step), untrack(minStepsBetweenValues))) {
      const reason = 'key' in event ? REASONS.keyboard : REASONS.inputChange;
      const applied = setValue(
        newValue,
        createChangeEventDetails(reason, event, undefined, {
          activeThumbIndex: index,
        }),
      );
      field.setTouched(true);

      if (applied) {
        onValueCommitted(newValue, createGenericEventDetails(reason, event));
      }
      return applied;
    }
    return false;
  }

  if (isDev) {
    createEffect(
      () => min() >= max(),
      (invalid) => {
        if (invalid) {
          warn('Slider `max` must be greater than `min`.');
        }
      },
    );
  }

  createEffect(disabled, (isDisabled) => {
    if (!isDisabled) {
      return;
    }

    const slider = sliderRef.current;
    const activeEl = activeElement(ownerDocument(slider));
    if (contains(slider, activeEl)) {
      // This is necessary because Firefox and Safari will keep focus
      // on a disabled element:
      // https://codesandbox.io/p/sandbox/mui-pr-22247-forked-h151h?file=/src/App.js
      // Blurring the thumb clears its active state.
      (activeEl as HTMLElement).blur();
    }
  });

  const state: SliderRootState = extendFieldRootState(field.state, {
    get activeThumbIndex() {
      return active();
    },
    get disabled() {
      return disabled();
    },
    get dragging() {
      return dragging();
    },
    get orientation() {
      return orientation();
    },
    get max() {
      return max();
    },
    get min() {
      return min();
    },
    get minStepsBetweenValues() {
      return minStepsBetweenValues();
    },
    get step() {
      return step();
    },
    get values() {
      return values();
    },
  });

  const contextValue: SliderRootContext = {
    get active() {
      return active();
    },
    controlRef,
    get disabled() {
      return disabled();
    },
    get dragging() {
      return dragging();
    },
    validation,
    get format() {
      return componentProps.format;
    },
    handleInputChange,
    get indicatorPosition() {
      return indicatorPosition();
    },
    get inset() {
      return thumbAlignment() !== 'center';
    },
    get isArrayValue() {
      return range();
    },
    get labelId() {
      return ariaLabelledby();
    },
    get rootLabelId() {
      return defaultLabelId();
    },
    get largeStep() {
      return largeStep();
    },
    get lastUsedThumbIndex() {
      return lastUsedThumbIndex();
    },
    lastChangeReasonRef,
    get form() {
      return componentProps.form;
    },
    get locale() {
      return componentProps.locale;
    },
    get max() {
      return max();
    },
    get min() {
      return min();
    },
    get minStepsBetweenValues() {
      return minStepsBetweenValues();
    },
    get name() {
      return name();
    },
    onValueCommitted,
    get orientation() {
      return orientation();
    },
    pressedThumbCenterOffsetRef,
    pressedThumbIndexRef,
    pressedValuesRef,
    registerFieldControlRef,
    get renderBeforeHydration() {
      return thumbAlignment() === 'edge';
    },
    setActive,
    setDragging,
    setIndicatorPosition,
    registerLabel() {
      setLabelCount((count) => count + 1);
      return () => {
        setLabelCount((count) => count - 1);
      };
    },
    setValue,
    state,
    get step() {
      return step();
    },
    get thumbCollisionBehavior() {
      return componentProps.thumbCollisionBehavior ?? 'push';
    },
    thumbList,
    get thumbMap() {
      return thumbList.map();
    },
    thumbRefs,
    registerThumb,
    get values() {
      return values();
    },
  };

  const rootProps: HTMLProps = {
    get 'aria-labelledby'() {
      return ariaLabelledby();
    },
    get id() {
      return id();
    },
    role: 'group',
  };

  return (
    <SliderRootContext value={contextValue}>
      <CompositeList list={thumbList}>
        {renderElement('div', componentProps, {
          state,
          ref: (element: HTMLElement) => {
            sliderRef.current = element;
          },
          props: [
            rootProps,
            elementProps,
            (props: HTMLProps) => validation.getValidationProps(disabled, props),
          ],
          stateAttributesMapping: sliderStateAttributesMapping,
        })}
      </CompositeList>
    </SliderRootContext>
  );
}

export interface SliderRootState extends FieldRootState {
  /**
   * The index of the active thumb.
   */
  activeThumbIndex: number;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the thumb is currently being dragged.
   */
  dragging: boolean;
  /**
   * The maximum value.
   */
  max: number;
  /**
   * The minimum value.
   */
  min: number;
  /**
   * The minimum steps between values in a range slider.
   * @default 0
   */
  minStepsBetweenValues: number;
  /**
   * The component orientation.
   */
  orientation: Orientation;
  /**
   * The step increment of the slider when incrementing or decrementing. It will snap
   * to multiples of this value. Decimal values are supported.
   * @default 1
   */
  step: number;
  /**
   * The raw number value of the slider.
   */
  values: readonly number[];
}

export interface SliderRootProps<
  Value extends number | readonly number[] = number | readonly number[],
> extends Omit<BaseUIComponentProps<'div', SliderRootState>, 'onChange'> {
  /**
   * The uncontrolled value of the slider when it's initially rendered.
   *
   * To render a controlled slider, use the `value` prop instead.
   */
  defaultValue?: Value | undefined;
  /**
   * Whether the slider should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   * When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum allowed value of the slider.
   * Should not be equal to min.
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum allowed value of the slider.
   * Should not be equal to max.
   * @default 0
   */
  min?: number | undefined;
  /**
   * The minimum steps between values in a range slider.
   * @default 0
   */
  minStepsBetweenValues?: number | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the slider inputs.
   * Useful when the slider is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The component orientation.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
  /**
   * The granularity with which the slider can step through values. (A "discrete" slider.)
   * The `min` prop serves as the origin for the valid values.
   * We recommend (max - min) to be evenly divisible by the step.
   * @default 1
   */
  step?: number | undefined;
  /**
   * The granularity with which the slider can step through values when using Page Up/Page Down or Shift + Arrow Up/Arrow Down.
   * @default 10
   */
  largeStep?: number | undefined;
  /**
   * How the thumb(s) are aligned relative to `Slider.Control` when the value is at `min` or `max`:
   * - `center`: The center of the thumb is aligned with the control edge
   * - `edge`: The thumb is inset within the control such that its edge is aligned with the control edge
   * - `edge-client-only`: Same as `edge` but renders after hydration on the client, reducing bundle size in return
   * @default 'center'
   */
  thumbAlignment?: 'center' | 'edge' | 'edge-client-only' | undefined;
  /**
   * Controls how thumbs behave when they collide during pointer interactions.
   *
   * - `'push'` (default): Thumbs push each other without restoring their previous positions when dragged back.
   * - `'swap'`: Thumbs swap places when dragged past each other.
   * - `'none'`: Thumbs cannot move past each other; excess movement is ignored.
   *
   * @default 'push'
   */
  thumbCollisionBehavior?: 'push' | 'swap' | 'none' | undefined;
  /**
   * The value of the slider.
   * For range sliders, provide an array with one value per thumb.
   */
  value?: Value | undefined;
  /**
   * Callback function that is fired when the slider's value changed.
   * Receives the new value as the first argument; the originating event is
   * available as `eventDetails.event`. The value is also reflected on
   * `eventDetails.event.target.value` for form integration.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   *
   * - `'input-change'` when the hidden range input emits a change event (for example, via form integration)
   * - `'track-press'` when the control track is pressed
   * - `'drag'` while dragging a thumb
   * - `'keyboard'` for keyboard input
   * - `'none'` when the change is triggered without a specific interaction
   */
  onValueChange?:
    | ((
        value: Value extends number ? number : Value,
        eventDetails: SliderRoot.ChangeEventDetails,
      ) => void)
    | undefined;
  /**
   * Callback function that is fired when a value change is committed.
   * Does not fire if the value did not change, or if the change was canceled.
   * **Warning**: This is a generic event, not a change event.
   *
   * The `eventDetails.reason` indicates what triggered the commit:
   *
   * - `'drag'` while dragging a thumb
   * - `'track-press'` when the control track is pressed
   * - `'keyboard'` for keyboard input
   * - `'input-change'` when the hidden range input emits a change event (for example, via form integration)
   * - `'none'` when the commit occurs without a specific interaction
   */
  onValueCommitted?:
    | ((
        value: Value extends number ? number : Value,
        eventDetails: SliderRoot.CommitEventDetails,
      ) => void)
    | undefined;
}

export interface SliderRootChangeEventCustomProperties {
  /**
   * The index of the active thumb at the time of the change.
   */
  activeThumbIndex: number;
}

export type SliderRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.trackPress
  | typeof REASONS.drag
  | typeof REASONS.keyboard
  | typeof REASONS.none;
export type SliderRootChangeEventDetails = BaseUIChangeEventDetails<
  SliderRoot.ChangeEventReason,
  SliderRootChangeEventCustomProperties
>;

export type SliderRootCommitEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.trackPress
  | typeof REASONS.drag
  | typeof REASONS.keyboard
  | typeof REASONS.none;
export type SliderRootCommitEventDetails = BaseUIGenericEventDetails<SliderRoot.CommitEventReason>;

export namespace SliderRoot {
  export type State = SliderRootState;
  export type Props<Value extends number | readonly number[] = number | readonly number[]> =
    SliderRootProps<Value>;
  export type ChangeEventReason = SliderRootChangeEventReason;
  export type ChangeEventDetails = SliderRootChangeEventDetails;
  export type CommitEventReason = SliderRootCommitEventReason;
  export type CommitEventDetails = SliderRootCommitEventDetails;
}
