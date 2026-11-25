import { createEffect, createMemo, createSignal, omit, onCleanup, Show, untrack } from 'solid-js';
import { isDev, type JSX } from '@solidjs/web';
import { clamp } from '@egoist/solid-base-utils/clamp';
import { createControllableSignal } from '@egoist/solid-base-utils/controlled';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from '@egoist/solid-base-utils/visuallyHidden';
import { warn } from '@egoist/solid-base-utils/warn';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { activeElement, contains } from '@egoist/solid-base-utils/shadowDom';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { createCompositeList } from '../../internals/composite/list/CompositeList';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import { createRegisterFieldControl } from '../../internals/field-register-control/createRegisterFieldControl';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { createAriaLabelledBy } from '../../internals/labelable-provider/createAriaLabelledBy';
import { createLabelableId } from '../../internals/labelable-provider/createLabelableId';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import type {
  BaseUIChangeEventDetails,
  BaseUIGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import { OTPFieldRootContext } from './OTPFieldRootContext';
import { rootStateAttributesMapping } from '../utils/stateAttributesMapping';
import {
  getOTPValidationConfig,
  normalizeOTPValue,
  normalizeOTPValueWithDetails,
} from '../utils/otp';
import type { OTPValidationType } from '../utils/otp';

/**
 * Groups all OTP field parts and manages their state.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI OTP Field](https://base-ui.com/react/components/otp-field)
 */
export function OTPFieldRoot(componentProps: OTPFieldRoot.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'aria-describedby',
    'aria-labelledby',
    'id',
    'autocomplete',
    'defaultValue',
    'value',
    'onValueChange',
    'onValueComplete',
    'onValueInvalid',
    'form',
    'length',
    'autoSubmit',
    'mask',
    'inputmode',
    'validationType',
    'normalizeValue',
    'disabled',
    'readOnly',
    'required',
    'name',
  );

  const field = useFieldRootContext();
  const { validation } = field;
  const formContext = useFormContext();
  const { getDescriptionProps, labelId } = useLabelableContext();

  const length = () => componentProps.length;
  const autoComplete = () => componentProps.autocomplete ?? 'one-time-code';
  const validationType = () => componentProps.validationType ?? 'numeric';
  const disabled = () => (field.disabled() ?? false) || (componentProps.disabled ?? false);
  const readOnly = () => componentProps.readOnly ?? false;
  const required = () => componentProps.required ?? false;
  const name = () => field.name() ?? componentProps.name;

  const [valueUnwrapped, setValueUnwrapped] = createControllableSignal<string>({
    value: () => componentProps.value,
    defaultValue: () => componentProps.defaultValue ?? '',
  });

  let rootElement: HTMLElement | null = null;
  let hiddenInputElement: HTMLInputElement | null = null;
  let pendingFocus: { index: number; value: string } | null = null;
  let pendingCompleteValue: {
    value: string;
    eventDetails: OTPFieldRoot.CompleteEventDetails;
  } | null = null;

  // Slot inputs, ordered by their document position when read. The composite list provides the
  // reactive slot indexes; this set answers imperative lookups right after slots (un)mount, before
  // the list re-sorts.
  const inputs = new Set<HTMLInputElement>();
  let guessCounter = 0;

  function getInputs() {
    return [...inputs]
      .filter((element) => element.isConnected)
      .sort((a, b) => {
        const position = a.compareDocumentPosition(b);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
          return -1;
        }
        if (position & Node.DOCUMENT_POSITION_PRECEDING) {
          return 1;
        }
        return 0;
      });
  }

  const [inputCount, setInputCount] = createSignal(0);
  const list = createCompositeList<{}>({
    onMapChange(map) {
      setInputCount(map.size);
    },
  });

  const firstInputRef: RefObject<HTMLElement | null> = {
    get current() {
      return getInputs()[0] ?? null;
    },
    set current(_value) {},
  };

  const id = createLabelableId({ id: () => componentProps.id });
  const ariaLabelledBy = createAriaLabelledBy({
    explicitAriaLabelledBy: () => componentProps['aria-labelledby'],
    labelId,
    labelSource: () => list.elements()[0],
    enableFallback: () => true,
    labelSourceId: id,
  });
  const inputAriaLabelledBy = () =>
    componentProps['aria-labelledby'] == null ? ariaLabelledBy() : undefined;
  const fieldDescriptionProps = getDescriptionProps({});
  const ariaDescribedBy = () =>
    mergeAriaIds(
      componentProps['aria-describedby'],
      fieldDescriptionProps['aria-describedby'] as string | undefined,
    );

  const validationConfig = () => getOTPValidationConfig(validationType());
  const pattern = () => validationConfig()?.slotPattern;
  const hiddenInputPattern = () => validationConfig()?.getRootPattern(length());
  const inputMode = () => componentProps.inputmode ?? validationConfig()?.inputMode;
  const hasValidLength = () => Number.isInteger(length()) && length() > 0;

  const value = createMemo(() =>
    normalizeOTPValue(
      valueUnwrapped(),
      length(),
      validationType(),
      componentProps.normalizeValue,
    ),
  );
  const filled = () => value() !== '';

  const [focusedIndex, setFocusedIndex] = createSignal(
    untrack(() => Math.min(value().length, length() - 1)),
  );
  const [focused, setFocusedState] = createSignal(false);

  const activeIndex = () =>
    focused()
      ? Math.min(focusedIndex(), Math.max(length() - 1, 0))
      : Math.min(value().length, length() - 1);

  createEffect(filled, (isFilled) => {
    field.setFilled(isFilled);
  });

  if (isDev) {
    createEffect(
      () => [inputCount(), length()] as const,
      ([count, currentLength]) => {
        if (
          !Number.isInteger(currentLength) ||
          currentLength <= 0 ||
          count === 0 ||
          count === currentLength
        ) {
          return;
        }
        warn(
          '<OTPField.Root> `length` must match the number of rendered ' +
            `<OTPField.Input /> parts. Received \`length={${currentLength}}\` but rendered ` +
            `${count} input${count === 1 ? '' : 's'}.`,
        );
      },
    );

    createEffect(length, (currentLength) => {
      if (Number.isInteger(currentLength) && currentLength > 0) {
        return;
      }
      warn(
        `<OTPField.Root> \`length\` must be a positive integer. Received \`length={${String(currentLength)}}\`.`,
      );
    });
  }

  createRegisterFieldControl({
    controlRef: firstInputRef,
    id,
    value,
    enabled: () => !disabled(),
    name: () => componentProps.name,
  });

  function focusInput(index: number) {
    const elements = getInputs();
    const targetIndex = clamp(index, 0, Math.max(elements.length - 1, 0));
    const target = elements[targetIndex];
    target?.focus();
    target?.select();
  }

  function queueFocusInput(index: number, nextValue: string) {
    pendingFocus = { index, value: nextValue };
  }

  function requestSubmit() {
    // Not `validation.inputRef`: outside a Field, every control shares it.
    // The hidden input only renders for a valid `length` and the slots may be portaled,
    // so prefer the hidden input's form before falling back to the first slot.
    let formElement = hiddenInputElement?.form ?? getInputs()[0]?.form ?? null;

    const formId = componentProps.form;
    if (formId) {
      const associatedElement = ownerDocument(rootElement).getElementById(formId);
      if (associatedElement?.tagName === 'FORM') {
        formElement = associatedElement as HTMLFormElement;
      }
    }

    if (formElement && typeof formElement.requestSubmit === 'function') {
      formElement.requestSubmit();
    }
  }

  function completeValue(
    completedValue: string,
    eventDetails: OTPFieldRoot.CompleteEventDetails,
  ) {
    componentProps.onValueComplete?.(completedValue, eventDetails);

    if (componentProps.autoSubmit) {
      requestSubmit();
    }
  }

  createEffect(
    value,
    // Imperative reaction to a committed value (upstream `useValueChanged`): reads the field state
    // at call time.
    (currentValue) => untrack(() => onValueChanged(currentValue)),
    { defer: true },
  );

  function onValueChanged(currentValue: string) {
    formContext.clearErrors(name());
    field.setDirty(currentValue !== field.validityData().initialValue);

    validation.change(currentValue);

    const focus = pendingFocus;
    if (focus != null) {
      pendingFocus = null;
      if (focus.value === currentValue) {
        focusInput(focus.index);
      }
    }

    // When the value shrinks externally, move focus off slots past the first empty one so typing
    // and Backspace keep working.
    const focusedElement = activeElement(ownerDocument(rootElement));
    if (
      focusedElement &&
      getInputs().indexOf(focusedElement as HTMLInputElement) > currentValue.length
    ) {
      focusInput(currentValue.length);
      // Slot indexes may not be updated yet when leading slots unmount, so sync the tab stop
      // with the redirect target directly.
      setFocusedIndex(currentValue.length);
    }

    const complete = pendingCompleteValue;
    if (complete != null) {
      pendingCompleteValue = null;
      if (complete.value === currentValue) {
        completeValue(currentValue, complete.eventDetails);
      }
    }
  }

  // Imperative: called from event handlers.
  function setValue(nextValue: string, details: OTPFieldRoot.ChangeEventDetails) {
    const currentLength = length();
    const currentValue = untrack(value);
    const normalizedValue = normalizeOTPValue(
      nextValue,
      currentLength,
      validationType(),
      componentProps.normalizeValue,
    );
    const canComplete =
      details.reason === REASONS.inputChange || details.reason === REASONS.inputPaste;
    const completeEventDetails =
      canComplete &&
      normalizedValue.length === currentLength &&
      (currentValue.length !== currentLength || details.reason === REASONS.inputPaste)
        ? createGenericEventDetails(
            details.reason as OTPFieldRoot.CompleteEventReason,
            details.event,
          )
        : null;

    if (normalizedValue === currentValue) {
      if (completeEventDetails != null) {
        completeValue(normalizedValue, completeEventDetails);
      }
      return null;
    }

    componentProps.onValueChange?.(normalizedValue, details);

    if (details.isCanceled) {
      return null;
    }

    setValueUnwrapped(normalizedValue);
    if (completeEventDetails != null) {
      pendingCompleteValue = { value: normalizedValue, eventDetails: completeEventDetails };
    } else if (normalizedValue.length !== currentLength) {
      pendingCompleteValue = null;
    }

    return normalizedValue;
  }

  function reportValueInvalid(invalidValue: string, details: OTPFieldRoot.InvalidEventDetails) {
    componentProps.onValueInvalid?.(invalidValue, details);
  }

  function handleInputFocus(
    index: number,
    event: FocusEvent & { currentTarget: HTMLInputElement },
  ) {
    const currentValue = untrack(value);
    if (index > currentValue.length) {
      focusInput(Math.min(currentValue.length, length() - 1));
      return;
    }

    setFocusedIndex(index);
    event.currentTarget.select();
  }

  function handleInputBlur(event: FocusEvent) {
    if (contains(rootElement, event.relatedTarget as Element | null)) {
      return;
    }

    field.setTouched(true);
    setFocusedState(false);
    field.setFocused(false);

    if (field.validationMode() === 'onBlur') {
      validation.commit(untrack(value));
    }
  }

  function getInputId(index: number) {
    const currentId = id();
    if (currentId == null) {
      return undefined;
    }
    return index === 0 ? currentId : `${currentId}-${index + 1}`;
  }

  const state: OTPFieldRootState = extendFieldRootState(field.state, {
    get complete() {
      return value().length === length();
    },
    get disabled() {
      return disabled();
    },
    get filled() {
      return filled();
    },
    get focused() {
      return focused();
    },
    get length() {
      return length();
    },
    get readOnly() {
      return readOnly();
    },
    get required() {
      return required();
    },
    get value() {
      return value();
    },
  });

  const contextValue: OTPFieldRootContext = {
    activeIndex,
    autoComplete,
    disabled,
    form: () => componentProps.form,
    focusInput,
    queueFocusInput,
    getInputId,
    getInputIndex(element) {
      return element ? getInputs().indexOf(element) : -1;
    },
    guessIndex() {
      const guess = guessCounter;
      guessCounter += 1;
      return guess;
    },
    handleInputBlur,
    handleInputFocus,
    inputMode,
    inputAriaLabelledBy,
    invalid: field.invalid,
    length,
    list,
    mask: () => componentProps.mask ?? false,
    normalizeValue: () => componentProps.normalizeValue,
    pattern,
    readOnly,
    registerInput(element) {
      inputs.add(element);
      return () => {
        inputs.delete(element);
      };
    },
    reportValueInvalid,
    required,
    setFocused: setFocusedState,
    setValue,
    state,
    validationType,
    value,
  };

  onCleanup(() => {
    if (validation.inputRef.current === hiddenInputElement) {
      validation.inputRef.current = null;
    }
  });

  const hiddenInputProps = validation.getValidationProps(disabled, {
    onFocus() {
      focusInput(0);
    },
    onInput(event: InputEvent) {
      const input = event.currentTarget as HTMLInputElement;
      const rawValue = input.value;
      const currentValue = untrack(value);
      // The DOM value always mirrors the committed value: an accepted change re-renders it.
      input.value = currentValue;

      if (event.defaultPrevented || disabled() || readOnly()) {
        return;
      }

      const [normalizedValue, didRejectCharacters] = normalizeOTPValueWithDetails(
        rawValue,
        length(),
        validationType(),
        componentProps.normalizeValue,
      );

      if (didRejectCharacters) {
        reportValueInvalid(rawValue, createGenericEventDetails(REASONS.inputChange, event));
      }

      const committedValue = setValue(
        normalizedValue,
        createChangeEventDetails(REASONS.inputChange, event),
      );

      if (committedValue != null && committedValue !== '') {
        queueFocusInput(committedValue.length - 1, committedValue);
      }
    },
  });

  return (
    <OTPFieldRootContext value={contextValue}>
      {renderElement('div', componentProps, {
        ref: (element: HTMLElement) => {
          rootElement = element;
        },
        state,
        props: [
          {
            role: 'group',
            get 'aria-describedby'() {
              return ariaDescribedBy();
            },
            get 'aria-labelledby'() {
              return ariaLabelledBy();
            },
          },
          elementProps,
        ],
        stateAttributesMapping: rootStateAttributesMapping,
      })}
      <Show when={hasValidLength()}>
        <input
          {...hiddenInputProps}
          ref={(element) => {
            hiddenInputElement = element;
            validation.inputRef.current = element;
          }}
          type="text"
          id={id() && name() == null ? `${id()}-hidden-input` : undefined}
          form={componentProps.form}
          name={name()}
          value={value()}
          autocomplete={autoComplete() as JSX.InputHTMLAttributes<HTMLInputElement>['autocomplete']}
          inputmode={inputMode()}
          minlength={length()}
          maxlength={length()}
          pattern={hiddenInputPattern()}
          disabled={disabled()}
          readonly={readOnly()}
          required={required()}
          aria-hidden="true"
          tabindex={-1}
          style={name() ? visuallyHiddenInput : visuallyHiddenInputPinned}
          onInvalid={handleHiddenInputInvalid}
        />
      </Show>
    </OTPFieldRootContext>
  );
}

function mergeAriaIds(...values: Array<string | undefined>) {
  const ids = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
  return ids.length > 0 ? Array.from(new Set(ids)).join(' ') : undefined;
}

export interface OTPFieldRootProps
  extends Omit<
    BaseUIComponentProps<'div', OTPFieldRootState>,
    'onChange' | 'id' | 'inputmode' | 'aria-labelledby' | 'aria-describedby'
  > {
  /**
   * The id(s) of the element(s) labelling the group. Not forwarded to the slot inputs.
   */
  'aria-labelledby'?: string | undefined;
  /**
   * The id(s) of the element(s) describing the group.
   */
  'aria-describedby'?: string | undefined;
  /**
   * The id of the first input element.
   * Subsequent inputs derive their ids from it (`{id}-2`, `{id}-3`, and so on).
   */
  id?: string | undefined;
  /**
   * The input autocomplete attribute. Applied to the first slot and hidden validation input.
   * @default 'one-time-code'
   */
  autocomplete?: string | undefined;
  /**
   * A string specifying the `form` element with which the hidden input is associated.
   * This string's value must match the id of a `form` element in the same document.
   */
  form?: string | undefined;
  /**
   * The number of OTP input slots.
   * Required so the root can clamp values, detect completion, and generate
   * consistent validation markup before all slots hydrate.
   */
  length: number;
  /**
   * Whether to submit the owning form when the OTP becomes complete.
   * @default false
   */
  autoSubmit?: boolean | undefined;
  /**
   * Whether the slot inputs should mask entered characters.
   * Pass `type` directly to individual `<OTPField.Input>` parts to use a custom
   * input type.
   * @default false
   */
  mask?: boolean | undefined;
  /**
   * The virtual keyboard hint applied to the slot inputs and hidden validation input.
   *
   * Built-in validation modes provide sensible defaults, but you can override them when needed.
   */
  inputmode?: JSX.HTMLAttributes<HTMLInputElement>['inputmode'] | undefined;
  /**
   * The type of input validation to apply to the OTP value.
   * @default 'numeric'
   */
  validationType?: OTPFieldRoot.ValidationType | undefined;
  /**
   * Function that normalizes the OTP value after whitespace and `validationType` filtering.
   * It runs whenever OTP Field normalizes a value, including initial/default values, controlled
   * values, and user edits.
   *
   * The returned value is filtered by `validationType` again, then clamped to `length`.
   * It should be idempotent because OTP Field may normalize the same value more than once while
   * handling edits, storing state, and rendering controlled or uncontrolled values. Non-idempotent
   * normalizers can compound across those normalization passes. Characters rejected while
   * normalizing typed or pasted text are reported through `onValueInvalid`.
   */
  normalizeValue?: ((value: string) => string) | undefined;
  /**
   * Whether the user must enter a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to change the field value.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * The OTP value.
   */
  value?: string | undefined;
  /**
   * The uncontrolled OTP value when the component is initially rendered.
   */
  defaultValue?: string | undefined;
  /**
   * Callback fired when the OTP value changes.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   * - `'input-change'` for typing or autofill
   * - `'input-clear'` when a character is removed by text input
   * - `'input-paste'` for paste interactions
   * - `'keyboard'` for keyboard interactions that change the value
   */
  onValueChange?:
    | ((value: string, eventDetails: OTPFieldRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * Callback fired when entered text contains characters that are rejected by validation or
   * normalization before the OTP value updates.
   *
   * The `value` argument is the attempted user-entered string before normalization.
   */
  onValueInvalid?:
    | ((value: string, eventDetails: OTPFieldRoot.InvalidEventDetails) => void)
    | undefined;
  /**
   * Callback function that is fired when the OTP value becomes complete, or when a complete value
   * is pasted while the OTP is already complete.
   *
   * When the value changes, it runs later than `onValueChange`, after the internal value update is
   * applied. If a complete pasted value matches the current value, `onValueChange` does not fire.
   *
   * If `autoSubmit` is enabled, it runs immediately before the owning form is submitted.
   */
  onValueComplete?:
    | ((value: string, eventDetails: OTPFieldRoot.CompleteEventDetails) => void)
    | undefined;
}

export interface OTPFieldRootState extends FieldRootState {
  /**
   * Whether all slots are filled.
   */
  complete: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * The number of OTP input slots.
   */
  length: number;
  /**
   * Whether the user should be unable to change the field value.
   */
  readOnly: boolean;
  /**
   * Whether the user must enter a value before submitting a form.
   */
  required: boolean;
  /**
   * The OTP value.
   */
  value: string;
}

export type OTPFieldRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.inputPaste
  | typeof REASONS.keyboard;
export type OTPFieldRootChangeEventDetails =
  BaseUIChangeEventDetails<OTPFieldRoot.ChangeEventReason>;

export type OTPFieldRootInvalidEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputPaste;
export type OTPFieldRootInvalidEventDetails =
  BaseUIGenericEventDetails<OTPFieldRoot.InvalidEventReason>;

export type OTPFieldRootCompleteEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputPaste;
export type OTPFieldRootCompleteEventDetails =
  BaseUIGenericEventDetails<OTPFieldRoot.CompleteEventReason>;

export namespace OTPFieldRoot {
  export type State = OTPFieldRootState;
  export type Props = OTPFieldRootProps;
  export type ValidationType = OTPValidationType;
  export type ChangeEventReason = OTPFieldRootChangeEventReason;
  export type ChangeEventDetails = OTPFieldRootChangeEventDetails;
  export type InvalidEventReason = OTPFieldRootInvalidEventReason;
  export type InvalidEventDetails = OTPFieldRootInvalidEventDetails;
  export type CompleteEventReason = OTPFieldRootCompleteEventReason;
  export type CompleteEventDetails = OTPFieldRootCompleteEventDetails;
}
