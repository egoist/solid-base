import { createEffect, createMemo, createSignal, omit, untrack } from 'solid-js';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import {
  FieldRootContext,
  type FieldRootContextValue,
} from '../../internals/field-root-context/FieldRootContext';
import {
  DEFAULT_VALIDITY_STATE,
  fieldValidityMapping,
} from '../../internals/field-constants/constants';
import { useFieldsetRootContext } from '../../fieldset/root/FieldsetRootContext';
import type { Form } from '../../form/Form';
import { useFormContext } from '../../internals/form-context/FormContext';
import { LabelableProvider } from '../../internals/labelable-provider/LabelableProvider';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { createActionsRef, type ActionsRef } from '../../internals/actionsRef';
import { createFieldValidation } from './createFieldValidation';
import { createFieldControlRegistration } from '../../internals/field-register-control/createFieldControlRegistration';
import type { FieldControlState } from '../../internals/field-root-context/FieldRootContext';

const NO_VALIDATION = () => null;

/**
 * @internal
 */
function FieldRootInner(componentProps: FieldRoot.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'validate',
    'validationDebounceTime',
    'validationMode',
    'name',
    'disabled',
    'invalid',
    'dirty',
    'touched',
    'actionsRef',
  );

  const formContext = useFormContext();
  const fieldset = useFieldsetRootContext(true);

  const disabled = () => (fieldset?.disabled() ?? false) || (componentProps.disabled ?? false);
  const validationMode = () => componentProps.validationMode ?? formContext.validationMode();

  const [touchedState, setTouchedState] = createSignal(false);
  const [dirtyState, setDirtyState] = createSignal(false);
  const [filledState, setFilledState] = createSignal(false);
  const [focused, setFocusedState] = createSignal(false);
  const focusOwnerRef = createRefObject<unknown>(undefined);
  // The value-derived state published by the control (see `createRegisterFieldControl`).
  const [controlState, setControlState] = createSignal<FieldControlState | null>(null, {
    name: 'FieldRoot.controlState',
  });

  const touched = () => componentProps.touched ?? touchedState();

  const markedDirtyRef = createRefObject(false);
  const registeredFieldIdRef = createRefObject<string | undefined>(undefined);
  const [registeredFieldName, setRegisteredFieldName] = createSignal<string | undefined>(
    undefined,
  );
  const effectiveName = () => componentProps.name ?? registeredFieldName();

  function setDirty(value: boolean) {
    if (untrack(() => componentProps.dirty) !== undefined) {
      return;
    }
    if (value) {
      markedDirtyRef.current = true;
    }
    setDirtyState(value);
  }

  function setTouched(value: boolean) {
    if (untrack(() => componentProps.touched) !== undefined) {
      return;
    }
    setTouchedState(value);
  }

  const shouldValidateOnChange = () => {
    const mode = validationMode();
    return mode === 'onChange' || (mode === 'onSubmit' && formContext.submitCountRef.current > 0);
  };

  const invalid = createMemo(() => {
    const name = effectiveName();
    const errors = formContext.errors();
    const formError = name && Object.hasOwn(errors, name) ? errors[name] : null;
    const hasFormError = !!(Array.isArray(formError) ? formError.length : formError);
    return componentProps.invalid === true || hasFormError;
  });

  const [validityData, setValidityDataState] = createSignal<FieldValidityData>({
    state: DEFAULT_VALIDITY_STATE,
    error: '',
    errors: [],
    value: null,
    initialValue: null,
  });
  const setValidityData: FieldRootContextValue['setValidityData'] = (next) =>
    setValidityDataState(next as any);

  // App-controlled invalidity (the `invalid` prop and `<Form>` errors) keeps the field marked
  // invalid even while disabled. Only computed validity (native constraints and `validate`)
  // is suppressed when disabled, matching `:disabled` not participating in constraint validation.
  const valid = createMemo(() => !invalid() && (disabled() ? null : validityData().state.valid));

  const state: FieldRootState = {
    get disabled() {
      return disabled();
    },
    get touched() {
      return touched();
    },
    get dirty() {
      return dirty();
    },
    get valid() {
      return valid();
    },
    get filled() {
      return filled();
    },
    get focused() {
      return focused();
    },
  };

  const validation = createFieldValidation({
    formContext,
    setValidityData,
    validate: (value, formValues) => (componentProps.validate ?? NO_VALIDATION)(value, formValues),
    validityData,
    validationDebounceTime: () => componentProps.validationDebounceTime ?? 0,
    invalid,
    markedDirtyRef,
    state,
    shouldValidateOnChange,
    validationMode,
    registeredFieldIdRef,
  });

  const registration = createFieldControlRegistration({
    formContext,
    change: validation.change,
    commit: validation.commit,
    invalid,
    markedDirtyRef,
    name: () => componentProps.name,
    setRegisteredFieldName,
    registeredFieldIdRef,
    setValidityData,
    validityData,
  });

  // Derived from the control's value where it publishes one, so the field state updates in the
  // same flush as the value. Controls without a reactive value write it through `setDirty`.
  const dirty = createMemo(
    () =>
      componentProps.dirty ??
      // The control's value is only compared once the field has its baseline.
      (registration.initialValueCaptured() ? controlState()?.dirty?.() : undefined) ??
      dirtyState(),
    { name: 'FieldRoot.dirty' },
  );
  const filled = createMemo(() => controlState()?.filled?.() ?? filledState(), {
    name: 'FieldRoot.filled',
  });
  // Runs on mount too, so a controlled `dirty` seeds the flag before any interaction. A field
  // that has been dirty once stays marked (it un-suppresses `valueMissing`).
  createEffect(
    () => [componentProps.dirty, dirty()] as const,
    ([dirtyProp, isDirty]) => {
      if (dirtyProp !== undefined) {
        markedDirtyRef.current = dirtyProp;
      } else if (isDirty) {
        markedDirtyRef.current = true;
      }
    },
  );

  createActionsRef(() => componentProps.actionsRef, { validate: registration.validate });

  const context: FieldRootContextValue = {
    invalid,
    name: effectiveName,
    validityData,
    setValidityData,
    disabled,
    setTouched,
    setDirty,
    // Return nothing, so they can be used directly as effect callbacks.
    setFilled: (value) => {
      setFilledState(value);
    },
    setFocused: (value) => {
      setFocusedState(value);
    },
    registerControlState(nextState) {
      setControlState(() => nextState);
      return () => {
        setControlState((current) => (current === nextState ? null : current));
      };
    },
    focusOwnerRef,
    validationMode,
    shouldValidateOnChange,
    state,
    registerFieldControl: registration.register,
    validation,
  };

  return (
    <FieldRootContext value={context}>
      {renderElement('div', componentProps, {
        state,
        props: elementProps,
        stateAttributesMapping: fieldValidityMapping,
      })}
    </FieldRootContext>
  );
}

/**
 * Groups all parts of the field.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldRoot(componentProps: FieldRoot.Props) {
  return (
    <LabelableProvider>
      <FieldRootInner {...componentProps} />
    </LabelableProvider>
  );
}

export interface FieldValidityData {
  state: {
    badInput: boolean;
    customError: boolean;
    patternMismatch: boolean;
    rangeOverflow: boolean;
    rangeUnderflow: boolean;
    stepMismatch: boolean;
    tooLong: boolean;
    tooShort: boolean;
    typeMismatch: boolean;
    valueMissing: boolean;
    valid: boolean | null;
  };
  error: string;
  errors: string[];
  value: unknown;
  initialValue: unknown;
}

export interface FieldRootActions {
  validate: () => void;
}

export interface FieldRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the field has been touched.
   */
  touched: boolean;
  /**
   * Whether the field value has changed from its initial value.
   */
  dirty: boolean;
  /**
   * Whether the field is valid.
   */
  valid: boolean | null;
  /**
   * Whether the field has a value.
   */
  filled: boolean;
  /**
   * Whether the field is focused.
   */
  focused: boolean;
}

export interface FieldRootProps extends BaseUIComponentProps<'div', FieldRootState> {
  /**
   * Whether the component should ignore user interaction.
   * Takes precedence over the `disabled` prop on the `<Field.Control>` component.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   * Takes precedence over the `name` prop on the `<Field.Control>` component.
   */
  name?: string | undefined;
  /**
   * A function for custom validation. Return a string or an array of strings with
   * the error message(s) if the value is invalid. Returning nothing, `null`, an empty
   * string, or an empty array means the value is valid.
   * Asynchronous functions are supported, but they do not prevent form submission
   * when using `validationMode="onSubmit"`.
   */
  validate?:
    | ((
        value: unknown,
        formValues: Form.Values,
      ) => string | string[] | null | void | Promise<string | string[] | null | void>)
    | undefined;
  /**
   * Determines when the field should be validated.
   * This takes precedence over the `validationMode` prop on `<Form>`.
   *
   * - `onSubmit`: triggers validation when the form is submitted, and re-validates on change after submission.
   * - `onBlur`: triggers validation when the control loses focus.
   * - `onChange`: triggers validation on every change to the control value.
   *
   * @default 'onSubmit'
   */
  validationMode?: Form.ValidationMode | undefined;
  /**
   * How long to wait between `validate` callbacks if
   * `validationMode="onChange"` is used. Specified in milliseconds.
   * @default 0
   */
  validationDebounceTime?: number | undefined;
  /**
   * Whether the field is invalid.
   * Useful when the field state is controlled by an external library.
   */
  invalid?: boolean | undefined;
  /**
   * Whether the field's value has been changed from its initial value.
   * Useful when the field state is controlled by an external library.
   */
  dirty?: boolean | undefined;
  /**
   * Whether the field has been touched.
   * Useful when the field state is controlled by an external library.
   */
  touched?: boolean | undefined;
  /**
   * A ref to imperative actions (a `{ current }` object or a callback).
   * - `validate`: Validates the field when called.
   */
  actionsRef?: ActionsRef<FieldRoot.Actions> | undefined;
}

export namespace FieldRoot {
  export type State = FieldRootState;
  export type Props = FieldRootProps;
  export type Actions = FieldRootActions;
}
