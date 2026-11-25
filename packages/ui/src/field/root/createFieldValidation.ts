import { merge, untrack, type Accessor } from 'solid-js';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { useLabelableContext, type StateSetter } from '../../internals/labelable-provider/LabelableContext';
import { mergeProps } from '../../merge-props/mergeProps';
import { DEFAULT_VALIDITY_STATE } from '../../internals/field-constants/constants';
import type { FormContextValue } from '../../internals/form-context/FormContext';
import type { Form } from '../../form/Form';
import { getCombinedFieldValidityData } from '../utils/getCombinedFieldValidityData';
import type { HTMLProps } from '../../internals/types';
import type { FieldValidityData, FieldRootState } from './FieldRoot';

const validityKeys = Object.keys(DEFAULT_VALIDITY_STATE) as Array<keyof ValidityState>;

export type RegisteredInput = {
  controlRef: RefObject<HTMLElement | null>;
  value: string | undefined;
};

export type RegisteredInputs = Map<HTMLInputElement, RegisteredInput>;

export type FieldValidateFn = (
  value: unknown,
  formValues: Form.Values,
) => string | string[] | null | void | Promise<string | string[] | null | void>;

/**
 * Whether an input participates in the surrounding Base UI Form. Inputs that are effectively
 * disabled, or whose `form` attribute explicitly associates them with another form, are excluded.
 * DOM position only matters when it associates the input with a different form. Otherwise, field
 * registration is context-driven, so portaled inputs (for example inside a dialog) still belong to
 * the form for both validation and values projected into `onFormSubmit`.
 */
export function isEligibleInput(input: HTMLInputElement, formElement: HTMLFormElement | null) {
  if (input.matches(':disabled')) {
    return false;
  }

  if (!formElement || input.form === formElement) {
    return true;
  }

  // Context crosses portal boundaries. An unassociated portaled input still participates in
  // contextual validation, unless an explicit `form` attribute opts it out of the surrounding Form.
  return input.form === null && !input.hasAttribute('form');
}

/**
 * Picks the input whose native validity should represent a field that owns several inputs (such as a
 * checkbox or radio group). Prefers the first eligible currently-invalid input, where "first" follows
 * registration order (mount order), and otherwise returns the first eligible input.
 */
function findRepresentativeInput(
  inputs: RegisteredInputs,
  formElement: HTMLFormElement | null,
): HTMLInputElement | null {
  let fallback: HTMLInputElement | null = null;
  for (const input of inputs.keys()) {
    if (!isEligibleInput(input, formElement)) {
      continue;
    }
    if (!input.validity.valid) {
      return input;
    }
    fallback ??= input;
  }
  return fallback;
}

function makeState(customError: boolean): FieldValidityData['state'] {
  return { ...DEFAULT_VALIDITY_STATE, valid: !customError, customError };
}

function getNativeErrors(element: HTMLInputElement | null): string[] {
  return element && element.validationMessage ? [element.validationMessage] : [];
}

export interface CreateFieldValidationParameters {
  formContext: FormContextValue;
  setValidityData: StateSetter<FieldValidityData>;
  validate: FieldValidateFn;
  validityData: Accessor<FieldValidityData>;
  validationDebounceTime: Accessor<number>;
  invalid: Accessor<boolean>;
  markedDirtyRef: RefObject<boolean>;
  state: FieldRootState;
  shouldValidateOnChange: () => boolean;
  validationMode: Accessor<Form.ValidationMode>;
  registeredFieldIdRef: RefObject<string | undefined>;
}

export interface FieldValidation {
  /**
   * Returns a live view of `props` with the field's `aria-describedby` (descriptions and errors)
   * and `aria-invalid` (while the field is invalid and the control is enabled).
   * Use it as the last function source of `renderElement`:
   * `(props) => validation.getValidationProps(disabled, props)`.
   */
  getValidationProps: (disabled: Accessor<boolean>, props?: HTMLProps) => HTMLProps;
  /**
   * The native input whose constraint validation is used. Assign it from a ref callback
   * (`ref: (el) => (validation.inputRef.current = el)`) and clear it on cleanup.
   */
  inputRef: RefObject<HTMLInputElement | null>;
  /**
   * Inputs registered by controls owning several inputs (checkbox and radio groups).
   */
  registeredInputs: RegisteredInputs;
  /**
   * Registers one of several inputs of the field. Returns the unregister function.
   */
  registerInput: (element: HTMLInputElement, registration: RegisteredInput) => () => void;
  /**
   * Returns the control of the representative registered input.
   */
  getInputControl: () => HTMLElement | null;
  /**
   * Validates `value` now (native constraints, then `validate`) and publishes the validity data.
   * With `revalidate`, only clears a resolved `valueMissing` error (used while typing in
   * `onSubmit`/`onBlur` mode).
   */
  commit: (value: unknown, revalidate?: boolean) => Promise<void>;
  /**
   * Reports a value change: validates according to the validation mode (debounced in `onChange`
   * mode). With `cancelPending`, only cancels the pending validation.
   */
  change: (value: unknown, cancelPending?: boolean) => void;
}

/**
 * The validation logic of `<Field.Root>`.
 * @internal
 */
export function createFieldValidation(params: CreateFieldValidationParameters): FieldValidation {
  const { elementRef, formRef } = params.formContext;
  const { controlId, getDescriptionProps } = useLabelableContext();

  const timeout = createTimeout();
  const inputRef: RefObject<HTMLInputElement | null> = { current: null };
  const registeredInputs: RegisteredInputs = new Map();
  let validationCommitId = 0;
  // Tracks the message installed by Base UI and the custom message it displaced.
  let customValidity: [element: HTMLInputElement, message: string, displaced: string] | null =
    null;

  // Groups register several inputs against a single field so focus, validation, and form-value
  // projection can use the same live controls. This also ensures a `required` checkbox can't be
  // satisfied by another input in the group, matching native per-checkbox behavior.
  function registerInput(element: HTMLInputElement, registration: RegisteredInput) {
    registeredInputs.set(element, registration);
    return () => {
      registeredInputs.delete(element);
    };
  }

  function getInputControl() {
    const element = findRepresentativeInput(registeredInputs, elementRef.current);
    return (element && registeredInputs.get(element)?.controlRef.current) || null;
  }

  // `commit` and `change` are imperative: they run from event handlers and effects, and read the
  // field state at call time.
  function commit(value: unknown, revalidate = false) {
    return untrack(() => runCommit(value, revalidate));
  }

  async function runCommit(value: unknown, revalidate: boolean) {
    validationCommitId += 1;
    const commitId = validationCommitId;
    const invalid = untrack(params.invalid);

    function updateRegisteredFieldValidity(
      nextValidityData: FieldValidityData,
      externalInvalid = invalid,
    ) {
      const fieldId = params.registeredFieldIdRef.current ?? untrack(controlId);
      if (fieldId == null) {
        return;
      }

      const currentFieldData = formRef.current.fields.get(fieldId);
      if (!currentFieldData) {
        return;
      }

      formRef.current.fields.set(fieldId, {
        ...currentFieldData,
        validityData: getCombinedFieldValidityData(nextValidityData, externalInvalid),
      });
    }

    function makeValidityData(
      validityState: FieldValidityData['state'],
      errorMessages: string[],
    ): FieldValidityData {
      // `valueMissing` may be suppressed while the native message remains non-empty.
      const errors = validityState.valid === false ? errorMessages : [];
      return {
        value,
        state: validityState,
        error: errors[0] ?? '',
        errors,
        initialValue: untrack(params.validityData).initialValue,
      };
    }

    function setCustomValidity(element: HTMLInputElement, message: string) {
      // Never reinstall a native constraint message as custom validity.
      const displaced = element.validity.customError ? element.validationMessage : '';
      const ownedMessage = message.replace(/\r\n?/g, '\n');
      element.setCustomValidity(ownedMessage);
      customValidity = [element, ownedMessage, displaced];
    }

    function clearCustomValidity() {
      const record = customValidity;
      customValidity = null;
      // Replacement transfers ownership; barred controls hide `validationMessage`.
      if (record && (!record[0].willValidate || record[0].validationMessage === record[1])) {
        record[0].setCustomValidity(record[2]);
      }
    }

    function publish(
      validityState: FieldValidityData['state'],
      errorMessages: string[],
      externalInvalid?: boolean,
    ) {
      const nextValidityData = makeValidityData(validityState, errorMessages);
      updateRegisteredFieldValidity(nextValidityData, externalInvalid);
      // The initial value may have been captured in the same frame: keep the latest one.
      params.setValidityData((prev) => ({ ...nextValidityData, initialValue: prev.initialValue }));
    }

    function getState(el: HTMLInputElement) {
      const computedState = validityKeys.reduce(
        (acc, key) => {
          acc[key] = el.validity[key];
          return acc;
        },
        {} as Record<keyof ValidityState, boolean>,
      ) as FieldValidityData['state'];

      let hasOnlyValueMissingError = false;

      for (const key of validityKeys) {
        if (key === 'valid') {
          continue;
        }
        if (key === 'valueMissing' && computedState[key]) {
          hasOnlyValueMissingError = true;
        } else if (computedState[key]) {
          return computedState;
        }
      }

      // Only make `valueMissing` mark the field invalid if it's been changed
      // to reduce error noise.
      // `dirty` is derived from the value: it is current even when the effect marking the
      // field hasn't run yet in this flush.
      if (params.state.dirty) {
        params.markedDirtyRef.current = true;
      }
      if (hasOnlyValueMissingError && !params.markedDirtyRef.current) {
        computedState.valid = true;
        computedState.valueMissing = false;
      }
      return computedState;
    }

    // A field can own several inputs (such as a checkbox or radio group). Validate against the
    // registry so every input counts; `inputRef` is the fallback only when none are registered.
    function resolveRepresentativeInput() {
      return registeredInputs.size > 0
        ? findRepresentativeInput(registeredInputs, elementRef.current)
        : inputRef.current;
    }

    // A field with no eligible input has no native constraint, but its custom validator still
    // applies to the logical value at the configured validation boundary.
    let element = resolveRepresentativeInput();

    function refreshState(): FieldValidityData['state'] {
      element = resolveRepresentativeInput();
      // Barred controls expose no usable native constraint state.
      return element?.willValidate ? getState(element) : makeState(false);
    }

    if (revalidate) {
      if (untrack(() => params.state.valid) !== false || !element) {
        return;
      }

      if (!element.validity.valueMissing) {
        // The 'valueMissing' (required) condition has been resolved by the user typing.
        // Temporarily mark the field as valid for this change.
        // Other native errors (e.g., typeMismatch) will be caught by full validation on blur or submit.
        // The required value is now present; ignore stale external invalid state for this pass.
        clearCustomValidity();
        // Clearing can make another registered input with a custom error representative.
        const currentElement = resolveRepresentativeInput();
        const foreign = currentElement?.validity.customError ? getNativeErrors(currentElement) : [];
        publish(makeState(foreign.length > 0), foreign, false);
        return;
      }

      // A stale custom error can coexist with valueMissing, but defer any other native errors.
      for (const key of validityKeys) {
        if (
          key !== 'valid' &&
          key !== 'valueMissing' &&
          key !== 'customError' &&
          element.validity[key]
        ) {
          return;
        }
      }

      // Value is still missing: publish the current native state so valueMissing and the changed
      // value are observable immediately. Full custom validation still waits for its boundary.
    }

    timeout.clear();

    // Do not read Base UI's previous message back as a native constraint.
    clearCustomValidity();

    let nextState = refreshState();
    let validationErrors = getNativeErrors(element);

    const isValidatingOnChange = params.shouldValidateOnChange();

    // Native or externally set errors take precedence outside onChange validation.
    if (validationErrors.length === 0 || isValidatingOnChange) {
      // Call the validate function because either
      // - validating on change, or
      // - native constraint validations passed, custom validity check is next
      const formValues = Array.from(formRef.current.fields.values()).reduce((acc, field) => {
        if (field.name) {
          acc[field.name] = field.getValue();
        }
        return acc;
      }, {} as Form.Values);

      const resultOrPromise = params.validate(value, formValues);
      let result: string | string[] | null | void;

      if (
        typeof resultOrPromise === 'object' &&
        resultOrPromise !== null &&
        'then' in resultOrPromise
      ) {
        // Validity is unknown while the validator runs, so go neutral, but keep what must block
        // submission synchronously: native failures, and a previous custom error outside onSubmit
        // mode. A previous native error is never kept, since `nextState` already carries the fresh
        // native verdict.
        if (nextState.valid === false) {
          publish(nextState, validationErrors);
        } else if (
          untrack(params.validationMode) === 'onSubmit' ||
          !untrack(params.validityData).state.customError
        ) {
          nextState.valid = null;
          publish(nextState, validationErrors);
        }

        // A rejected validator keeps the previously published state, so a transient
        // failure can't retire an error and unblock submission.
        result = await resultOrPromise;

        if (commitId !== validationCommitId) {
          return;
        }
        nextState = refreshState();
      } else {
        result = resultOrPromise;
      }

      // Empty results and empty array entries are valid.
      validationErrors = result ? ([] as string[]).concat(result).filter(Boolean) : [];

      if (validationErrors.length > 0) {
        nextState.valid = false;
        nextState.customError = true;
        // Keep custom errors for barred controls in field state only.
        if (element?.willValidate) {
          setCustomValidity(element, validationErrors.join('\n'));
        }
      } else {
        validationErrors = getNativeErrors(element);
      }
    }

    publish(nextState, validationErrors);
  }

  function change(value: unknown, cancelPending = false) {
    untrack(() => runChange(value, cancelPending));
  }

  function runChange(value: unknown, cancelPending: boolean) {
    timeout.clear();
    validationCommitId += 1;
    if (cancelPending) {
      return;
    }

    const validateOnChange = params.shouldValidateOnChange();
    const debounceTime = untrack(params.validationDebounceTime);

    if (validateOnChange && value !== '' && debounceTime) {
      timeout.start(debounceTime, () => {
        commit(value);
      });
    } else {
      commit(value, !validateOnChange);
    }
  }

  function getValidationProps(disabled: Accessor<boolean>, externalProps: HTMLProps = {}) {
    return mergeProps<HTMLProps>(
      getDescriptionProps(externalProps),
      merge(() =>
        params.state.valid === false && !params.state.disabled && !disabled()
          ? { 'aria-invalid': true }
          : {},
      ),
    );
  }

  return {
    getValidationProps,
    inputRef,
    registeredInputs,
    registerInput,
    getInputControl,
    commit,
    change,
  };
}
