import { createEffect, createSignal, omit } from 'solid-js';
import { EMPTY_OBJECT } from '@egoist/solid-base-utils/empty';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import { createGenericEventDetails } from '../internals/createBaseUIEventDetails';
import type { BaseUIGenericEventDetails } from '../internals/createBaseUIEventDetails';
import { REASONS } from '../internals/reasons';
import type { BaseUIComponentProps } from '../internals/types';
import {
  FormContext,
  type Errors,
  type FormContextValue,
} from '../internals/form-context/FormContext';
import { renderElement } from '../internals/renderElement';
import { createActionsRef, type ActionsRef } from '../internals/actionsRef';

/**
 * A native form element with consolidated error handling.
 * Renders a `<form>` element.
 *
 * Documentation: [Solid Base Form](https://base.egoist.dev/components/form)
 */
export function Form<FormValues extends Record<string, any> = Record<string, any>>(
  componentProps: Form.Props<FormValues>,
) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'validationMode',
    'errors',
    'onSubmit',
    'onFormSubmit',
    'actionsRef',
  );

  const formRef: FormContextValue['formRef'] = createRefObject({ fields: new Map() });
  const elementRef = createRefObject<HTMLFormElement | null>(null);
  const submitCountRef = createRefObject(0);
  let submitted = false;

  function focusFirstInvalid() {
    // A field can be invalid without a focusable control (for example a checkbox group whose
    // custom validation failed while every checkbox is unmounted, disabled, or reassociated).
    // Keep submission blocked, but move focus to the first invalid field that has a usable control.
    // Registration order can diverge from DOM order (keyed fields reordered without
    // remounting, portals), so pick the first control by document position. For controls
    // in disconnected trees (e.g. separate shadow roots), where document position is
    // implementation-specific, keep registration order.
    let hasInvalid = false;
    let firstControl: HTMLElement | null = null;
    for (const field of formRef.current.fields.values()) {
      if (field.validityData.state.valid !== false) {
        continue;
      }
      hasInvalid = true;
      const control = field.controlRef.current;
      if (control && (!firstControl || comesBeforeInSameTree(control, firstControl))) {
        firstControl = control;
      }
    }
    if (firstControl) {
      firstControl.focus();
      if (firstControl.tagName === 'INPUT') {
        (firstControl as HTMLInputElement).select();
      }
      return true;
    }
    return hasInvalid;
  }

  // Follows the `errors` prop, and can be cleared field by field locally.
  const [errors, setErrors] = createSignal<Errors | undefined>(() => componentProps.errors);

  createEffect(errors, () => {
    if (!submitted) {
      return;
    }

    submitted = false;
    // Fields refresh their registry entries (combined with the new errors) in their own effects,
    // which run after this one in the same flush. Focus once they are all up to date.
    queueMicrotask(focusFirstInvalid);
  });

  createActionsRef(() => componentProps.actionsRef, {
    validate(fieldName?: string) {
      if (fieldName) {
        Array.from(formRef.current.fields.values())
          .find((field) => field.name === fieldName)
          ?.validate();
      } else {
        formRef.current.fields.forEach((field) => {
          field.validate();
        });
      }
    },
  });

  function clearErrors(name: string | undefined) {
    if (!name) {
      return;
    }
    setErrors((previousErrors) => {
      if (!previousErrors || !Object.hasOwn(previousErrors, name)) {
        return previousErrors;
      }
      const nextErrors = { ...previousErrors };
      delete nextErrors[name];
      return nextErrors;
    });
  }

  const context: FormContextValue = {
    elementRef,
    formRef,
    validationMode: () => componentProps.validationMode ?? 'onSubmit',
    errors: () => errors() ?? (EMPTY_OBJECT as Errors),
    clearErrors,
    submitCountRef,
  };

  return (
    <FormContext value={context}>
      {renderElement('form', componentProps, {
        ref: (element: HTMLFormElement) => {
          elementRef.current = element;
        },
        props: [
          {
            novalidate: true,
            onSubmit(event: SubmitEvent) {
              submitCountRef.current += 1;

              // Async validation isn't supported to stop the submit event.
              formRef.current.fields.forEach((field) => {
                field.validate();
              });

              if (focusFirstInvalid()) {
                event.preventDefault();
                return;
              }

              submitted = true;
              callHandler(componentProps.onSubmit, event);

              const onFormSubmit = componentProps.onFormSubmit;
              if (onFormSubmit) {
                event.preventDefault();

                const formValues = {} as Record<string, any>;
                formRef.current.fields.forEach((field) => {
                  if (field.name) {
                    formValues[field.name] = field.getValue();
                  }
                });

                onFormSubmit(
                  formValues as FormValues,
                  createGenericEventDetails(REASONS.none, event),
                );
              }
            },
          },
          elementProps,
        ],
      })}
    </FormContext>
  );
}

function callHandler(handler: unknown, event: Event) {
  if (typeof handler === 'function') {
    handler(event);
  } else if (Array.isArray(handler) && typeof handler[0] === 'function') {
    handler[0](handler[1], event);
  }
}

export type FormSubmitEventReason = typeof REASONS.none;
export type FormSubmitEventDetails = BaseUIGenericEventDetails<Form.SubmitEventReason>;

export type FormValidationMode = 'onSubmit' | 'onBlur' | 'onChange';

export interface FormActions {
  validate: (fieldName?: string | undefined) => void;
}

export interface FormState {}

export interface FormProps<FormValues extends Record<string, any> = Record<string, any>>
  extends BaseUIComponentProps<'form', FormState> {
  /**
   * Determines when the form should be validated.
   * The `validationMode` prop on `<Field.Root>` takes precedence over this.
   *
   * - `onSubmit` (default): validates the field when the form is submitted, afterwards fields will re-validate on change.
   * - `onBlur`: validates a field when it loses focus.
   * - `onChange`: validates the field on every change to its value.
   *
   * @default 'onSubmit'
   */
  validationMode?: FormValidationMode | undefined;
  /**
   * Validation errors returned externally, typically after submission by a server or a form action.
   * This should be an object where keys correspond to the `name` attribute on `<Field.Root>`,
   * and values correspond to error(s) related to that field.
   */
  errors?: Errors | undefined;
  /**
   * Event handler called when the form is submitted.
   * `preventDefault()` is called on the native submit event when used.
   */
  onFormSubmit?:
    | ((formValues: FormValues, eventDetails: Form.SubmitEventDetails) => void)
    | undefined;
  /**
   * A ref to imperative actions (a `{ current }` object or a callback).
   * - `validate`: Validates all fields when called. Optionally pass a field name to validate a single field.
   * @example
   * ```tsx
   * // validate all fields
   * actionsRef.current?.validate();
   *
   * // validate one field
   * actionsRef.current?.validate('email');
   * ```
   */
  actionsRef?: ActionsRef<Form.Actions> | undefined;
}

export namespace Form {
  export type Props<FormValues extends Record<string, any> = Record<string, any>> =
    FormProps<FormValues>;
  export type State = FormState;
  export type Actions = FormActions;
  export type ValidationMode = FormValidationMode;
  export type SubmitEventReason = FormSubmitEventReason;
  export type SubmitEventDetails = FormSubmitEventDetails;

  export type Values<FormValues extends Record<string, any> = Record<string, any>> = FormValues;
}

/* eslint-disable no-bitwise */
function comesBeforeInSameTree(element: Node, reference: Node) {
  const position = element.compareDocumentPosition(reference);
  return (
    (position & Node.DOCUMENT_POSITION_DISCONNECTED) === 0 &&
    (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
}
