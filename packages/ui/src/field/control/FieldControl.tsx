import { createEffect, merge, omit, onCleanup, onSettled, untrack } from 'solid-js';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import type { FieldRootState } from '../root/FieldRoot';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import { createSetFieldFocused } from '../../internals/field-root-context/createSetFieldFocused';
import { createRegisterFieldControl } from '../../internals/field-register-control/createRegisterFieldControl';
import { createFieldValueChanged } from '../../internals/field-register-control/createFieldValueChanged';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { createLabelableId } from '../../internals/labelable-provider/createLabelableId';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';

/**
 * The form control to label and validate.
 * Renders an `<input>` element.
 *
 * You can omit this part and use any Solid Base input component instead. For example,
 * [Input](/components/input), [Checkbox](/components/checkbox),
 * or [Select](/components/select), among others, will work with Field out of the box.
 *
 * Documentation: [Solid Base Field](https://base.egoist.dev/components/field)
 */
export function FieldControl(componentProps: FieldControl.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'id',
    'name',
    'value',
    'disabled',
    'onValueChange',
    'defaultValue',
    'autofocus',
  );

  const field = useFieldRootContext();
  const { validation } = field;
  const form = useFormContext();
  const { labelId } = useLabelableContext();

  const disabled = () => (field.disabled() ?? false) || (componentProps.disabled ?? false);
  const name = () => field.name() ?? componentProps.name;

  const state: FieldControlState = extendFieldRootState(field.state, {
    get disabled() {
      return disabled();
    },
  });

  const id = createLabelableId({ id: () => componentProps.id });

  const isControlled = () => componentProps.value !== undefined;
  // The DOM value is always a string, so dirty comparisons must serialize the controlled value.
  const serializedValue = () => {
    const value = componentProps.value;
    return value == null ? undefined : String(value);
  };

  let inputElement: HTMLInputElement | null = null;
  const controlRef = createRefObject<HTMLElement | null>(null);

  createRegisterFieldControl({
    controlRef,
    id,
    value: serializedValue,
    getValue: () => validation.inputRef.current?.value,
    enabled: () => !disabled(),
    name: () => componentProps.name,
    // Uncontrolled inputs keep their value in the DOM: their state is written on input.
    dirty: () => {
      const value = serializedValue();
      return value === undefined
        ? undefined
        : value !== (field.validityData().initialValue ?? '');
    },
    filled: () => {
      const value = serializedValue();
      return value === undefined ? undefined : value !== '';
    },
  });

  // An uncontrolled input's value lives in the DOM: read it once rendered, and again when the
  // `defaultValue` it renders changes.
  createEffect(
    () => [isControlled(), componentProps.defaultValue] as const,
    ([controlled]) => {
      if (!controlled) {
        const currentValue = validation.inputRef.current?.value;
        if (currentValue !== undefined) {
          field.setFilled(currentValue !== '');
        }
      }
    },
  );

  createFieldValueChanged(serializedValue, (value) => {
    if (value === undefined) {
      return;
    }
    form.clearErrors(name());
    validation.change(value);
  });

  const setFocused = createSetFieldFocused(disabled, () => inputElement);
  const enterValidationTimeout = createTimeout();

  onSettled(() => {
    if (untrack(() => componentProps.autofocus) && inputElement) {
      inputElement.focus();
    }
  });

  onCleanup(() => {
    if (validation.inputRef.current === inputElement) {
      validation.inputRef.current = null;
    }
  });

  return renderElement('input', componentProps, {
    ref: (element: HTMLInputElement) => {
      inputElement = element;
      controlRef.current = element;
      validation.inputRef.current = element;
    },
    state,
    props: [
      {
        get id() {
          return id();
        },
        get disabled() {
          return disabled();
        },
        get name() {
          return name();
        },
        get 'aria-labelledby'() {
          return labelId();
        },
        get autofocus() {
          return componentProps.autofocus;
        },
        onInput(event: InputEvent) {
          const input = event.currentTarget as HTMLInputElement;
          const inputValue = input.value;
          const details = createChangeEventDetails(REASONS.none, event);
          componentProps.onValueChange?.(inputValue, details);

          // Controlled values sync from the `value` prop instead, so that a value the consumer
          // rejects or rewrites never reaches the field state.
          if (isControlled()) {
            return;
          }

          // `validation.change` reads the dirty flag, so update dirty before validating.
          field.setDirty(inputValue !== (field.validityData().initialValue ?? ''));
          field.setFilled(inputValue !== '');

          if (!event.defaultPrevented && !details.isCanceled) {
            form.clearErrors(name());
            validation.change(inputValue);
          }
        },
        onFocus() {
          setFocused(true);
        },
        onBlur(event: FocusEvent) {
          field.setTouched(true);
          setFocused(false);

          if (field.validationMode() === 'onBlur') {
            const inputValue = (event.currentTarget as HTMLInputElement).value;
            validation.commit(inputValue);

            if (isControlled()) {
              // Controlled blur handlers can normalize the value before this microtask runs.
              // A rewrite back to the initial value is a programmatic reset: the field looks
              // pristine, so committing it would only surface `valueMissing` noise.
              queueMicrotask(() => {
                const nextValue = validation.inputRef.current?.value;
                if (
                  nextValue !== undefined &&
                  nextValue !== inputValue &&
                  nextValue !== (field.validityData().initialValue ?? '')
                ) {
                  validation.commit(nextValue);
                }
              });
            }
          }
        },
        onKeyDown(event: KeyboardEvent) {
          const input = event.currentTarget as HTMLInputElement;
          if (input.tagName === 'INPUT' && event.key === 'Enter') {
            field.setTouched(true);
            const value = input.value;
            const formElement = input.form;
            if (formElement && formElement === form.elementRef.current && !event.defaultPrevented) {
              const submitCount = form.submitCountRef.current;

              // Implicit submission runs after keydown. Fall back unless Form handles it first.
              enterValidationTimeout.start(0, () => {
                if (form.submitCountRef.current === submitCount) {
                  validation.commit(input.value);
                }
              });
            } else {
              validation.commit(value);
            }
          }
        },
      },
      merge(() =>
        isControlled()
          ? { value: componentProps.value }
          : { defaultValue: componentProps.defaultValue },
      ),
      elementProps,
      (props: HTMLProps) => validation.getValidationProps(disabled, props),
    ],
    stateAttributesMapping: fieldValidityMapping,
  });
}

export interface FieldControlState extends FieldRootState {}

export interface FieldControlProps
  extends Omit<
    BaseUIComponentProps<'input', FieldControlState>,
    'id' | 'name' | 'disabled' | 'value' | 'defaultValue'
  > {
  /**
   * The id of the input. A generated id is used by default.
   */
  id?: string | undefined;
  /**
   * Identifies the field when a form is submitted.
   * The `name` prop on `<Field.Root>` takes precedence over this.
   */
  name?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * The `disabled` prop on `<Field.Root>` takes precedence over this.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Callback fired when the `value` changes. Use when controlled.
   */
  onValueChange?:
    | ((value: string, eventDetails: FieldControl.ChangeEventDetails) => void)
    | undefined;
  /**
   * The default value of the input. Use when uncontrolled.
   */
  defaultValue?: string | number | readonly string[] | undefined;
  /**
   * The value of the input. Use when controlled.
   */
  value?: string | number | readonly string[] | null | undefined;
}

export type FieldControlChangeEventReason = typeof REASONS.none;

export type FieldControlChangeEventDetails =
  BaseUIChangeEventDetails<FieldControl.ChangeEventReason>;

export namespace FieldControl {
  export type State = FieldControlState;
  export type Props = FieldControlProps;
  export type ChangeEventReason = FieldControlChangeEventReason;
  export type ChangeEventDetails = FieldControlChangeEventDetails;
}
