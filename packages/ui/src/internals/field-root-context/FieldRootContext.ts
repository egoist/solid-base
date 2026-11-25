import { createContext, merge, useContext, type Accessor } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { NOOP } from '../noop';
import { DEFAULT_FIELD_ROOT_STATE, DEFAULT_VALIDITY_STATE } from '../field-constants/constants';
import type { FieldValidityData, FieldRootState } from '../../field/root/FieldRoot';
import type { FormValidationMode } from '../../form/Form';
import type { FieldValidation } from '../../field/root/createFieldValidation';
import type { HTMLProps } from '../types';
import type { FieldControlRegistration } from '../field-register-control/createFieldControlRegistration';
import type { StateSetter } from '../labelable-provider/LabelableContext';

/**
 * State a control derives from its value. Published with `registerControlState`, so the field
 * reads it in the same flush as the value instead of having it written after the fact.
 * An accessor returning `undefined` falls back to the state written with `setDirty`/`setFilled`.
 */
export interface FieldControlState {
  dirty?: Accessor<boolean | undefined> | undefined;
  filled?: Accessor<boolean | undefined> | undefined;
}

export interface FieldRootContextValue {
  /**
   * Whether the field is marked invalid by the app (`invalid` prop or `<Form errors>`).
   */
  invalid: Accessor<boolean | undefined>;
  /**
   * The field name: `<Field.Root name>`, or the name of the registered control.
   */
  name: Accessor<string | undefined>;
  validityData: Accessor<FieldValidityData>;
  setValidityData: StateSetter<FieldValidityData>;
  /**
   * Whether the field (or an enclosing fieldset) is disabled.
   */
  disabled: Accessor<boolean | undefined>;
  setTouched: (touched: boolean) => void;
  setDirty: (dirty: boolean) => void;
  setFilled: (filled: boolean) => void;
  setFocused: (focused: boolean) => void;
  /**
   * Publishes the value-derived state of the control. Returns the unregister function.
   */
  registerControlState: (state: FieldControlState) => () => void;
  /**
   * Identifies the control the focused state belongs to, so that disabling or unmounting a
   * different control in the same field can't clear it. Written through `createSetFieldFocused`.
   */
  focusOwnerRef: RefObject<unknown>;
  validationMode: Accessor<FormValidationMode>;
  /**
   * Whether a value change should run full validation (`onChange` mode, or `onSubmit` mode after
   * the form was submitted once).
   */
  shouldValidateOnChange: () => boolean;
  /**
   * The live state of the field. Controls extend it (see `extendFieldRootState`) so that they
   * get the same `data-*` attributes.
   */
  state: FieldRootState;
  registerFieldControl: (
    source: symbol,
    registration: FieldControlRegistration | undefined,
  ) => void;
  validation: FieldValidation;
}

/**
 * Creates the inert context used by controls rendered outside of `<Field.Root>`.
 */
export function createDefaultFieldRootContext(): FieldRootContextValue {
  const validityData: FieldValidityData = {
    state: DEFAULT_VALIDITY_STATE,
    errors: [],
    error: '',
    value: '',
    initialValue: null,
  };
  return {
    invalid: () => undefined,
    name: () => undefined,
    validityData: () => validityData,
    setValidityData: NOOP,
    disabled: () => undefined,
    setTouched: NOOP,
    setDirty: NOOP,
    setFilled: NOOP,
    setFocused: NOOP,
    registerControlState: () => NOOP,
    focusOwnerRef: { current: undefined },
    validationMode: () => 'onSubmit',
    shouldValidateOnChange: () => false,
    state: DEFAULT_FIELD_ROOT_STATE,
    registerFieldControl: NOOP,
    validation: {
      getValidationProps: (_disabled, props: HTMLProps = {}) => props,
      inputRef: { current: null },
      registeredInputs: new Map(),
      registerInput: () => NOOP,
      getInputControl: () => null,
      commit: async () => {},
      change: NOOP,
    },
  };
}

export const FieldRootContext = createContext<FieldRootContextValue | null>(null);

/**
 * Returns the closest `<Field.Root>` context.
 * With `optional` (the default), returns an inert context outside of a field, so controls can
 * use it unconditionally.
 */
export function useFieldRootContext(optional = true): FieldRootContextValue {
  const context = useContext(FieldRootContext);

  if (context == null) {
    if (!optional) {
      throw new Error(
        'Base UI: FieldRootContext is missing. Field parts must be placed within <Field.Root>.',
      );
    }
    return createDefaultFieldRootContext();
  }

  return context;
}

/**
 * Returns a live state object made of the field state and `extra` (whose getters win), for
 * controls whose state extends `FieldRootState` (upstream's `{ ...fieldState, checked }`).
 */
export function extendFieldRootState<Extra extends object>(
  fieldState: FieldRootState,
  extra: Extra,
): Omit<FieldRootState, keyof Extra> & Extra {
  return merge(fieldState, extra) as Omit<FieldRootState, keyof Extra> & Extra;
}
