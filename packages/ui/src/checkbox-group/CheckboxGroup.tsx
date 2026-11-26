import { omit, untrack } from 'solid-js';
import { createControllableSignal } from '@egoist/solid-base-utils/controlled';
import { EMPTY_ARRAY } from '@egoist/solid-base-utils/empty';
import { areArraysEqual } from '@egoist/solid-base-utils/areArraysEqual';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { createBaseUiId } from '../internals/baseUiId';
import { renderElement } from '../internals/renderElement';
import { CheckboxGroupContext, type CheckboxGroupContextValue } from './CheckboxGroupContext';
import type { FieldRootState } from '../field/root/FieldRoot';
import { isEligibleInput } from '../field/root/createFieldValidation';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../internals/field-root-context/FieldRootContext';
import { createRegisterFieldControl } from '../internals/field-register-control/createRegisterFieldControl';
import { createFieldValueChanged } from '../internals/field-register-control/createFieldValueChanged';
import { useLabelableContext } from '../internals/labelable-provider/LabelableContext';
import { createLabelableId } from '../internals/labelable-provider/createLabelableId';
import type { BaseUIComponentProps, HTMLProps } from '../internals/types';
import { fieldValidityMapping } from '../internals/field-constants/constants';
import { createCheckboxGroupParent } from './createCheckboxGroupParent';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { REASONS } from '../internals/reasons';
import { useFormContext } from '../internals/form-context/FormContext';

/**
 * Provides a shared state to a series of checkboxes.
 *
 * Documentation: [Solid Base Checkbox Group](https://base.egoist.dev/components/checkbox-group)
 */
export function CheckboxGroup(componentProps: CheckboxGroup.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'allValues',
    'defaultValue',
    'disabled',
    'id',
    'onValueChange',
    'value',
  );

  const field = useFieldRootContext();
  const { validation } = field;
  const { labelId, registerControlId, getDescriptionProps } = useLabelableContext();
  const form = useFormContext();

  const disabled = () => (field.disabled() ?? false) || (componentProps.disabled ?? false);

  const [value, setValueUnwrapped] = createControllableSignal<string[]>({
    value: () => componentProps.value,
    defaultValue: () => componentProps.defaultValue ?? EMPTY_ARRAY,
  });

  function setValue(nextValue: string[], eventDetails: CheckboxGroup.ChangeEventDetails) {
    componentProps.onValueChange?.(nextValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(nextValue);
  }

  const parent = createCheckboxGroupParent({
    allValues: () => componentProps.allValues,
    value,
    onValueChange: setValue,
  });

  // The group is the field's control and takes its name from `aria-labelledby`, so `Field.Label`
  // must not point `for` at one arbitrary checkbox inside the group.
  createLabelableId({ id: () => null });

  const id = createBaseUiId(() => componentProps.id);

  const controlRef: RefObject<HTMLElement | null> = {
    get current() {
      return validation.getInputControl();
    },
    set current(_value) {},
  };

  function getFormValue() {
    const currentValue = untrack(value);
    const formElement = form.elementRef.current;
    if (!formElement) {
      return currentValue;
    }

    const successfulValues = new Set<string>();
    for (const [input, registration] of validation.registeredInputs) {
      if (
        registration.value !== undefined &&
        input.checked &&
        isEligibleInput(input, formElement)
      ) {
        successfulValues.add(registration.value);
      }
    }

    return currentValue.filter((inputValue) => successfulValues.has(inputValue));
  }

  createRegisterFieldControl({
    controlRef,
    id,
    value,
    getValue: getFormValue,
    // The group has no `name` of its own: it only takes part while the field is named.
    enabled: () => !!field.name() && !disabled(),
    dirty: () => {
      const initialValue = field.validityData().initialValue;
      return !areArraysEqual(
        value(),
        Array.isArray(initialValue) ? (initialValue as readonly string[]) : EMPTY_ARRAY,
      );
    },
    filled: () => value().length > 0,
  });

  createFieldValueChanged(value, (currentValue) => {
    const fieldName = field.name();
    if (fieldName) {
      form.clearErrors(fieldName);
    }
    validation.change(currentValue);
  });

  const state: CheckboxGroupState = extendFieldRootState(field.state, {
    get disabled() {
      return disabled();
    },
  });

  const contextValue: CheckboxGroupContextValue = {
    allValues: () => componentProps.allValues,
    value,
    setValue,
    parent,
    disabled,
    validation,
    registerControlId,
  };

  return (
    <CheckboxGroupContext value={contextValue}>
      {renderElement('div', componentProps, {
        state,
        props: [
          {
            get id() {
              return componentProps.id;
            },
            role: 'group',
            get 'aria-labelledby'() {
              return labelId();
            },
          } satisfies HTMLProps,
          elementProps,
          getDescriptionProps,
        ],
        stateAttributesMapping: fieldValidityMapping,
      })}
    </CheckboxGroupContext>
  );
}

export interface CheckboxGroupState extends FieldRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface CheckboxGroupProps extends Omit<
  BaseUIComponentProps<'div', CheckboxGroupState>,
  'defaultValue' | 'id'
> {
  /**
   * The id of the group element.
   */
  id?: string | undefined;
  /**
   * Names of the checkboxes in the group that should be ticked.
   *
   * To render an uncontrolled checkbox group, use the `defaultValue` prop instead.
   */
  value?: string[] | undefined;
  /**
   * Names of the checkboxes in the group that should be initially ticked.
   *
   * To render a controlled checkbox group, use the `value` prop instead.
   */
  defaultValue?: string[] | undefined;
  /**
   * Event handler called when a checkbox in the group is ticked or unticked.
   * Provides the new value as an argument.
   */
  onValueChange?:
    | ((value: string[], eventDetails: CheckboxGroupChangeEventDetails) => void)
    | undefined;
  /**
   * Names of all checkboxes in the group. Use this when creating a parent checkbox.
   */
  allValues?: string[] | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type CheckboxGroupChangeEventReason = typeof REASONS.none;
export type CheckboxGroupChangeEventDetails =
  BaseUIChangeEventDetails<CheckboxGroup.ChangeEventReason>;

export namespace CheckboxGroup {
  export type State = CheckboxGroupState;
  export type Props = CheckboxGroupProps;
  export type ChangeEventReason = CheckboxGroupChangeEventReason;
  export type ChangeEventDetails = CheckboxGroupChangeEventDetails;
}
