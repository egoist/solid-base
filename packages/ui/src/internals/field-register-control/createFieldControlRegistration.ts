import { createEffect, onCleanup, untrack, type Accessor } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { getCombinedFieldValidityData } from '../../field/utils/getCombinedFieldValidityData';
import type { FormContextValue } from '../form-context/FormContext';
import type { FieldValidityData } from '../../field/root/FieldRoot';
import type { StateSetter } from '../labelable-provider/LabelableContext';

export interface FieldControlRegistration {
  /**
   * The element focused when the form is submitted with this field invalid.
   */
  controlRef: RefObject<HTMLElement | null>;
  /**
   * The key of the field in the form registry (usually the control id).
   */
  id: string | undefined;
  /**
   * The control's own `name`, used when `<Field.Root>` has none.
   */
  name?: string | undefined;
  /**
   * Reads the value submitted through `onFormSubmit` (and passed to validators) when `value` is
   * `undefined` (e.g. an uncontrolled text input).
   */
  getValue?: (() => unknown) | undefined;
  /**
   * The control's current value.
   */
  value: unknown;
}

export interface CreateFieldControlRegistrationParameters {
  formContext: FormContextValue;
  change: (value: unknown, cancelPending?: boolean) => void;
  commit: (value: unknown) => void;
  invalid: Accessor<boolean>;
  markedDirtyRef: RefObject<boolean>;
  name: Accessor<string | undefined>;
  setRegisteredFieldName: (name: string | undefined) => void;
  registeredFieldIdRef: RefObject<string | undefined>;
  setValidityData: StateSetter<FieldValidityData>;
  validityData: Accessor<FieldValidityData>;
}

export interface CreateFieldControlRegistrationReturnValue {
  /**
   * Validates the registered control's current value (the `validate` action of the field).
   */
  validate: () => void;
  /**
   * Registers (or unregisters, with `undefined`) the control owned by `source`.
   */
  register: (source: symbol, registration: FieldControlRegistration | undefined) => void;
}

/**
 * Tracks the control registered in a `<Field.Root>` and mirrors it in the form registry.
 * @internal Used by `<Field.Root>`. Controls use `createRegisterFieldControl`.
 */
export function createFieldControlRegistration(
  params: CreateFieldControlRegistrationParameters,
): CreateFieldControlRegistrationReturnValue {
  const { formRef } = params.formContext;

  let activeSource: symbol | null = null;
  let registration: FieldControlRegistration | null = null;
  let initialValueCaptured = false;

  function getValueForForm() {
    if (!registration) {
      return undefined;
    }
    if (registration.getValue) {
      return registration.getValue();
    }
    return registration.value;
  }

  function getRegistrationValue(current: FieldControlRegistration) {
    return current.value === undefined ? getValueForForm() : current.value;
  }

  function validate() {
    untrack(runValidate);
  }

  function runValidate() {
    params.markedDirtyRef.current = true;

    if (!registration) {
      params.commit(params.validityData().value);
      return;
    }

    params.commit(getRegistrationValue(registration));
  }

  function writeEntry(current: FieldControlRegistration, id: string) {
    formRef.current.fields.set(id, {
      getValue: getValueForForm,
      name: untrack(params.name) ?? current.name,
      controlRef: current.controlRef,
      validityData: getCombinedFieldValidityData(
        untrack(params.validityData),
        untrack(params.invalid),
      ),
      validate,
    });
  }

  function refreshRegistration() {
    if (registration?.id) {
      writeEntry(registration, registration.id);
    }
  }

  function deleteRegistration(id = registration?.id) {
    if (id) {
      formRef.current.fields.delete(id);
    }
  }

  // The baseline belongs to the field, not to a control instance: a control that unmounts and
  // remounts (or is swapped for another one) comes back as a brand new registration. Capturing
  // more than once would turn whichever value the control happens to hold at that point into the
  // initial value. Consumers that want a fresh baseline remount `<Field.Root>` itself.
  function captureInitialValue(current: FieldControlRegistration) {
    if (initialValueCaptured) {
      return;
    }

    initialValueCaptured = true;
    const initialValue = getRegistrationValue(current);

    params.setValidityData((prev) =>
      prev.initialValue === initialValue ? prev : { ...prev, initialValue },
    );
  }

  // Keep the registry entry in sync with the field name, external invalidity and validity data.
  createEffect(
    () => [params.name(), params.invalid(), params.validityData()] as const,
    ([name]) => {
      if (!registration?.id) {
        return;
      }
      params.setRegisteredFieldName(name ? undefined : registration.name);
      writeEntry(registration, registration.id);
    },
  );

  onCleanup(() => deleteRegistration());

  function register(source: symbol, next: FieldControlRegistration | undefined) {
    untrack(() => runRegister(source, next));
  }

  function runRegister(source: symbol, next: FieldControlRegistration | undefined) {
    if (!next) {
      if (activeSource === source) {
        activeSource = null;
        params.change(undefined, true);
        deleteRegistration();
        registration = null;
        params.setRegisteredFieldName(undefined);
        params.registeredFieldIdRef.current = undefined;
      }
      return;
    }

    const previousId = registration?.id;
    const previousSource = activeSource;

    // Drop work owned by a replaced control, but not on first registration.
    if (previousSource && previousSource !== source) {
      params.change(undefined, true);
    }

    activeSource = source;
    registration = next;
    if (!params.name()) {
      params.setRegisteredFieldName(next.name);
    }
    params.registeredFieldIdRef.current = next.id;

    if (previousId && previousId !== next.id) {
      deleteRegistration(previousId);
    }

    captureInitialValue(next);
    refreshRegistration();
  }

  return { validate, register };
}
