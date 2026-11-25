import { createEffect, omit, onCleanup, untrack } from 'solid-js';
import { createControllableSignal } from '@egoist/solid-base-utils/controlled';
import { contains } from '@egoist/solid-base-utils/shadowDom';
import { applyRef, type RefProp } from '@egoist/solid-base-utils/refs';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { BaseUIComponentProps, HTMLProps } from '../internals/types';
import { createBaseUiId } from '../internals/baseUiId';
import { SHIFT, type ModifierKey } from '../internals/composite/composite';
import { CompositeRoot } from '../internals/composite/root/CompositeRoot';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../internals/field-root-context/FieldRootContext';
import { createRegisterFieldControl } from '../internals/field-register-control/createRegisterFieldControl';
import { fieldValidityMapping } from '../internals/field-constants/constants';
import type { FieldRootState } from '../field/root/FieldRoot';
import { isEligibleInput } from '../field/root/createFieldValidation';
import { useFieldsetRootContext } from '../fieldset/root/FieldsetRootContext';
import { useFormContext } from '../internals/form-context/FormContext';
import { useLabelableContext } from '../internals/labelable-provider/LabelableContext';
import { RadioGroupContext, type RadioGroupContextValue } from './RadioGroupContext';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { REASONS } from '../internals/reasons';

const MODIFIER_KEYS: ModifierKey[] = [SHIFT];

/**
 * Provides shared state to a series of radio buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Radio Group](https://base-ui.com/react/components/radio-group)
 */
export function RadioGroup<Value>(componentProps: RadioGroup.Props<Value>) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'readOnly',
    'required',
    'onValueChange',
    'value',
    'defaultValue',
    'form',
    'name',
    'inputRef',
    'id',
  );

  const field = useFieldRootContext();
  const { validation } = field;
  const { labelId } = useLabelableContext();
  const form = useFormContext();
  const fieldsetContext = useFieldsetRootContext(true);

  const disabled = () => (field.disabled() ?? false) || (componentProps.disabled ?? false);
  const readOnly = () => componentProps.readOnly ?? false;
  const required = () => componentProps.required ?? false;
  const name = () => field.name() ?? componentProps.name;
  const id = createBaseUiId(() => componentProps.id);

  const [checkedValue, setCheckedValueUnwrapped] = createControllableSignal<Value | undefined>({
    value: () => componentProps.value,
    defaultValue: () => componentProps.defaultValue,
  });

  // Only read by event handlers (an arrow key press, then the focus it causes), so a plain
  // variable: a signal would only expose the write after the next flush.
  let touched = false;

  function setCheckedValue(value: Value, eventDetails: RadioGroup.ChangeEventDetails) {
    componentProps.onValueChange?.(value, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setCheckedValueUnwrapped(value);
  }

  const controlRef: RefObject<HTMLElement | null> = {
    get current() {
      return validation.getInputControl();
    },
    set current(_value) {},
  };

  let groupInput: HTMLInputElement | null = null;
  let firstEnabledInput: HTMLInputElement | null = null;
  let appliedInputRef: RefProp<HTMLInputElement | null> = undefined;
  let inputRefCleanup: (() => void) | null = null;

  // Only forwards the public `inputRef` and tracks the current representative for that forwarding.
  // The registry (`validation.registeredInputs`) is authoritative for validation and form-value
  // projection, so the group must not write `validation.inputRef`: a stale, unmounted radio left
  // there would become the Field's fallback once the registry empties and keep blocking submission.
  function setInputRef(hiddenInput: HTMLInputElement | null) {
    const inputRef = untrack(() => componentProps.inputRef);
    if (groupInput === hiddenInput && appliedInputRef === inputRef) {
      return;
    }

    groupInput = hiddenInput;
    appliedInputRef = inputRef;

    // Like a merged ref: detach the previous binding (its returned cleanup, or a `null` call)
    // before attaching the new one.
    const cleanup = inputRefCleanup;
    inputRefCleanup = null;
    cleanup?.();

    if (hiddenInput && inputRef) {
      const result: unknown =
        typeof inputRef === 'function' ? inputRef(hiddenInput) : applyRef(inputRef, hiddenInput);
      inputRefCleanup =
        typeof result === 'function'
          ? (result as () => void)
          : () => applyRef(inputRef, null);
    }
  }

  onCleanup(() => setInputRef(null));

  // Re-apply the current representative when the `inputRef` prop changes.
  createEffect(
    () => componentProps.inputRef,
    () => {
      setInputRef(groupInput);
    },
    { defer: true },
  );

  function registerInputRef(input: HTMLInputElement | null) {
    if (!input) {
      return undefined;
    }

    if (!input.disabled) {
      if (!firstEnabledInput) {
        firstEnabledInput = input;
      }

      const currentInput = groupInput;
      if (input.checked || currentInput == null || currentInput.disabled) {
        setInputRef(input);
      }
    }

    // Detach when this input unmounts while still forwarded, so consumers don't
    // keep holding a disconnected node. The input may have become the forwarded
    // one after attach (via the re-registration effect), so always return this.
    return () => {
      if (firstEnabledInput === input) {
        firstEnabledInput = null;
      }
      if (groupInput === input) {
        setInputRef(null);
      }
    };
  }

  function getFormValue() {
    const value = untrack(checkedValue);
    const formElement = form.elementRef.current;
    if (!formElement) {
      return value ?? null;
    }

    for (const input of validation.registeredInputs.keys()) {
      if (input.checked && isEligibleInput(input, formElement)) {
        return value ?? null;
      }
    }

    return null;
  }

  createRegisterFieldControl({
    controlRef,
    id,
    value: () => checkedValue() ?? null,
    getValue: getFormValue,
    enabled: () => !disabled(),
    name: () => componentProps.name,
  });

  createEffect(
    checkedValue,
    (value) => {
      untrack(() => {
        form.clearErrors(name());
        field.setDirty(value !== field.validityData().initialValue);
      });
      field.setFilled(value != null);

      validation.change(value);

      const fallbackInput = firstEnabledInput;
      if (value == null && fallbackInput && !fallbackInput.disabled) {
        setInputRef(fallbackInput);
      }
    },
    { defer: true },
  );

  const state: RadioGroupState = extendFieldRootState(field.state, {
    get disabled() {
      return disabled();
    },
    get required() {
      return required();
    },
    get readOnly() {
      return readOnly();
    },
  });

  const contextValue: RadioGroupContextValue<Value> = {
    checkedValue,
    disabled,
    form: () => componentProps.form,
    validation,
    name,
    readOnly,
    registerInputRef,
    required,
    setCheckedValue,
    setTouched(next) {
      touched = next;
    },
    touched: () => touched,
  };

  const defaultProps: HTMLProps = {
    get id() {
      return componentProps.id;
    },
    role: 'radiogroup',
    get 'aria-required'() {
      return required() || undefined;
    },
    get 'aria-disabled'() {
      return disabled() || undefined;
    },
    get 'aria-readonly'() {
      return readOnly() || undefined;
    },
    get 'aria-labelledby'() {
      return labelId() ?? fieldsetContext?.legendId();
    },
    // `focusout` rather than `blur`: it bubbles from the radios (React's `onBlur` semantics).
    onFocusOut(event: FocusEvent) {
      if (!contains(event.currentTarget as Element, event.relatedTarget as Element | null)) {
        touched = false;
        field.setTouched(true);
        field.setFocused(false);

        if (field.validationMode() === 'onBlur') {
          validation.commit(untrack(checkedValue));
        }
      }
    },
    // Runs in the capture phase, before the composite moves the focus (and checks the radio).
    ref(element: HTMLElement) {
      element.addEventListener(
        'keydown',
        (event) => {
          if (event.key.startsWith('Arrow')) {
            touched = true;
          }
        },
        { capture: true },
      );
    },
  };

  return (
    <RadioGroupContext value={contextValue}>
      <CompositeRoot
        render={componentProps.render}
        class={componentProps.class}
        style={componentProps.style}
        state={state}
        props={[
          defaultProps,
          elementProps,
          (props: HTMLProps) => validation.getValidationProps(disabled, props),
        ]}
        stateAttributesMapping={fieldValidityMapping}
        enableHomeAndEndKeys={false}
        modifierKeys={MODIFIER_KEYS}
      />
    </RadioGroupContext>
  );
}

export interface RadioGroupState extends FieldRootState {
  /**
   * Whether the user should be unable to select a different radio button in the group.
   */
  readOnly: boolean;
  /**
   * Whether the user must tick a radio button within the group before submitting a form.
   */
  required: boolean;
}

export interface RadioGroupProps<Value = any> extends Omit<
  BaseUIComponentProps<'div', RadioGroupState>,
  'value' | 'defaultValue' | 'id'
> {
  /**
   * The id of the radio group element.
   */
  id?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to select a different radio button in the group.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the radio inputs.
   * Useful when the radio group is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The controlled value of the radio item that should be currently selected.
   *
   * To render an uncontrolled radio group, use the `defaultValue` prop instead.
   */
  value?: Value | undefined;
  /**
   * The uncontrolled value of the radio button that should be initially selected.
   *
   * To render a controlled radio group, use the `value` prop instead.
   */
  defaultValue?: Value | undefined;
  /**
   * Callback fired when the value changes.
   */
  onValueChange?:
    | ((value: Value, eventDetails: RadioGroup.ChangeEventDetails) => void)
    | undefined;
  /**
   * A ref to access the hidden input element (the checked one, or the first enabled one).
   * Called with `null` when that input unmounts.
   */
  inputRef?: RefProp<HTMLInputElement | null>;
}

export type RadioGroupChangeEventReason = typeof REASONS.none;

export type RadioGroupChangeEventDetails = BaseUIChangeEventDetails<RadioGroup.ChangeEventReason>;

export namespace RadioGroup {
  export type State = RadioGroupState;
  export type Props<TValue = any> = RadioGroupProps<TValue>;
  export type ChangeEventReason = RadioGroupChangeEventReason;
  export type ChangeEventDetails = RadioGroupChangeEventDetails;
}
