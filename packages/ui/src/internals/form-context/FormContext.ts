import { createContext, useContext, type Accessor } from 'solid-js';
import { EMPTY_OBJECT } from '@egoist/solid-base-utils/empty';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { FieldValidityData } from '../../field/root/FieldRoot';
import type { FormValidationMode } from '../../form/Form';
import { NOOP } from '../noop';

export type Errors = Record<string, string | string[]>;

/**
 * A field registered in a form (one per `<Field.Root>` with a registered control).
 */
export interface FormField {
  name: string | undefined;
  /**
   * After this returns, the field registry entry reflects the latest synchronous
   * validity verdict. Async validators do not block submit.
   */
  validate: () => void;
  validityData: FieldValidityData;
  controlRef: RefObject<HTMLElement | null>;
  getValue: () => unknown;
}

export interface FormContextValue {
  /**
   * The external errors (`errors` prop), minus the ones cleared since they were received.
   */
  errors: Accessor<Errors>;
  /**
   * Removes the external error of a field, once its value changed.
   */
  clearErrors: (name: string | undefined) => void;
  /**
   * The rendered `<form>` element.
   */
  elementRef: RefObject<HTMLFormElement | null>;
  /**
   * The registry of fields, keyed by their control id. Imperative by design: it is read on submit.
   */
  formRef: RefObject<{ fields: Map<string, FormField> }>;
  validationMode: Accessor<FormValidationMode>;
  /**
   * How many times the form was submitted. Fields in `onSubmit` mode revalidate on change once
   * this is greater than 0.
   */
  submitCountRef: RefObject<number>;
}

export const FormContext = createContext<FormContextValue | null>(null);

const EMPTY_ERRORS = () => EMPTY_OBJECT as Errors;
const ON_SUBMIT = () => 'onSubmit' as const;

/**
 * Creates the context used by fields outside of a `<Form>`. Each call returns a fresh registry so
 * that unrelated fields never share state.
 */
export function createDefaultFormContext(): FormContextValue {
  return {
    errors: EMPTY_ERRORS,
    clearErrors: NOOP,
    elementRef: { current: null },
    formRef: { current: { fields: new Map() } },
    validationMode: ON_SUBMIT,
    submitCountRef: { current: 0 },
  };
}

/**
 * Returns the closest `<Form>` context, or a standalone context when there is none.
 * Call it once per component and share the result: outside of a form, each call returns a new
 * registry.
 */
export function useFormContext(): FormContextValue {
  return useContext(FormContext) ?? createDefaultFormContext();
}
