import { createEffect, createSignal, merge, omit, onCleanup, untrack } from 'solid-js';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import { applyRef, type RefProp } from '@egoist/solid-base-utils/refs';
import {
  visuallyHiddenInput,
  visuallyHiddenInputPinned,
} from '@egoist/solid-base-utils/visuallyHidden';
import type {
  BaseUIComponentProps,
  HTMLProps,
  NonNativeButtonProps,
} from '../../internals/types';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { createBaseUiId } from '../../internals/baseUiId';
import { renderElement } from '../../internals/renderElement';
import { createButton } from '../../internals/use-button/createButton';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import type { FieldRootState } from '../../field/root/FieldRoot';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import { createSetFieldFocused } from '../../internals/field-root-context/createSetFieldFocused';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { createAriaLabelledBy } from '../../internals/labelable-provider/createAriaLabelledBy';
import { createLabelableId } from '../../internals/labelable-provider/createLabelableId';
import { resolveRenderedAriaLabel } from '../../internals/resolveRenderedAriaLabel';
import { useRadioGroupContext } from '../../radio-group/RadioGroupContext';
import { serializeValue } from '../../internals/serializeValue';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import { mergeProps, type PropsSource } from '../../merge-props/mergeProps';
import { RadioRootContext } from './RadioRootContext';

/**
 * Represents the radio button itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Radio](https://base-ui.com/react/components/radio-group)
 */
export function RadioRoot<Value>(componentProps: RadioRoot.Props<Value>) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'readOnly',
    'required',
    'aria-labelledby',
    'value',
    'inputRef',
    'nativeButton',
    'id',
  );

  const groupContext = useRadioGroupContext<Value>();
  const validation = groupContext?.validation;

  const field = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const { labelId, getDescriptionProps } = useLabelableContext();

  const disabledGroup = () => groupContext?.disabled() ?? false;
  const disabled = () =>
    (field.disabled() ?? false) ||
    fieldItemContext.disabled() ||
    disabledGroup() ||
    (componentProps.disabled ?? false);
  const readOnly = () => (groupContext?.readOnly() ?? false) || (componentProps.readOnly ?? false);
  const required = () => (groupContext?.required() ?? false) || (componentProps.required ?? false);
  const nativeButton = () => componentProps.nativeButton ?? false;

  const checked = () =>
    groupContext
      ? groupContext.checkedValue() === componentProps.value
      : (componentProps.value as unknown) === '';

  const radioRef = createRefObject<HTMLElement | null>(null);
  const setFieldFocused = createSetFieldFocused(disabled, () => radioRef.current);
  const [inputElement, setInputElement] = createSignal<HTMLInputElement | null>(null);

  // Group radios register their inputs, so that the group validates and submits them all.
  createEffect(inputElement, (element) => {
    if (!element || !validation) {
      return undefined;
    }
    return validation.registerInput(element, { controlRef: radioRef, value: undefined });
  });

  createEffect(inputElement, (element) => {
    if (element?.checked) {
      field.setFilled(true);
    }
  });

  let unregisterInputRef: (() => void) | undefined;
  onCleanup(() => unregisterInputRef?.());

  createEffect(
    () => [inputElement(), checked(), disabled()] as const,
    ([element, isChecked, isDisabled]) => {
      if (!element || !groupContext) {
        return;
      }

      if (isDisabled && isChecked) {
        groupContext.registerInputRef(null);
        return;
      }

      const unregister = groupContext.registerInputRef(element);
      // The first registration owns the unmount cleanup (it always detaches this input).
      unregisterInputRef ??= unregister;
    },
  );

  const id = createBaseUiId();
  const inputId = createLabelableId({ id: () => componentProps.id });
  const hiddenInputId = () => (nativeButton() ? undefined : inputId());
  const ariaLabelledBy = createAriaLabelledBy({
    explicitAriaLabelledBy: () => componentProps['aria-labelledby'] as string | undefined,
    labelId,
    labelSource: inputElement,
    enableFallback: () => !nativeButton(),
    labelSourceId: hiddenInputId,
    ariaLabel: () =>
      resolveRenderedAriaLabel(componentProps as { 'aria-label'?: string | undefined }),
  });

  const rootProps: HTMLProps = {
    role: 'radio',
    get 'aria-checked'() {
      return checked();
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
    get [ACTIVE_COMPOSITE_ITEM]() {
      return checked() ? '' : undefined;
    },
    get id() {
      return nativeButton() ? inputId() : id();
    },
    onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter') {
        // Radio only activates with Space. Preventing the keydown's default
        // stops createButton from turning Enter into a click.
        event.preventDefault();
      }
    },
    onClick(event: MouseEvent) {
      if (event.defaultPrevented || disabled() || readOnly()) {
        return;
      }

      event.preventDefault();

      const input = untrack(inputElement);
      if (!input) {
        return;
      }

      dispatchClickWithModifiers(input, event);
    },
    onFocus(event: FocusEvent) {
      setFieldFocused(true);

      if (event.defaultPrevented || disabled() || readOnly() || !groupContext?.touched()) {
        return;
      }

      untrack(inputElement)?.click();

      groupContext.setTouched(false);
    },
    onBlur() {
      // A grouped radio's exit is cleared by the group's `contains`-guarded blur handler, so
      // radio-to-radio moves inside the group don't churn the focused state.
      if (!groupContext) {
        setFieldFocused(false);
      }
    },
  };

  // Only a fully disabled group leaves the tab order. A single disabled radio
  // keeps the composite tab index.
  const groupDisabledProps = merge(() => (disabledGroup() ? { tabindex: -1 } : {}));

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: nativeButton,
    composite: () => false,
  });

  const inputProps = mergeProps<HTMLProps>(
    {
      type: 'radio',
      'aria-hidden': 'true',
      tabindex: -1,
      ref(element: HTMLInputElement) {
        setInputElement(element);
        applyRef(componentProps.inputRef, element);
      },
      get form() {
        return groupContext?.form();
      },
      get id() {
        return hiddenInputId();
      },
      get name() {
        return groupContext?.name();
      },
      get style() {
        return groupContext?.name() ? visuallyHiddenInput : visuallyHiddenInputPinned;
      },
      onInvalid: handleHiddenInputInvalid,
      get disabled() {
        return disabled();
      },
      get checked() {
        return checked();
      },
      get required() {
        return required();
      },
      get readonly() {
        return readOnly();
      },
      // The hidden input gets checked natively when clicked (by the root, a label, the arrow key
      // focus, or directly). Its checked state always mirrors the group value, so the native
      // change is reverted and the binding applies the new group value, if any.
      onClick(event: MouseEvent) {
        // Clicks dispatched on the input from the root's `onClick` and `onFocus` are an
        // implementation detail and must not reach ancestors.
        event.stopPropagation();

        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault();

        const value = componentProps.value;
        // Like a native `change` event, only an unchecked radio getting checked is a change.
        if (untrack(checked) || disabled() || readOnly() || value === undefined) {
          return;
        }

        const details = createChangeEventDetails(REASONS.none, event);

        groupContext?.setCheckedValue(value, details);

        if (details.isCanceled) {
          return;
        }

        field.setTouched(true);
      },
      onFocus() {
        radioRef.current?.focus();
      },
    },
    merge(() =>
      componentProps.value !== undefined ? { value: serializeValue(componentProps.value) } : {},
    ),
  );

  const state: RadioRootState = extendFieldRootState(field.state, {
    get required() {
      return required();
    },
    get disabled() {
      return disabled();
    },
    get readOnly() {
      return readOnly();
    },
    get checked() {
      return checked();
    },
  });

  const refs = [
    (element: HTMLElement) => {
      radioRef.current = element;
    },
    buttonRef,
  ];

  const props: PropsSource<any>[] = [
    rootProps,
    groupDisabledProps,
    elementProps,
    getButtonProps,
    getDescriptionProps,
    validation
      ? (validationProps: HTMLProps) => validation.getValidationProps(disabled, validationProps)
      : undefined,
  ];

  // Component boundaries keep the element creation out of the provider's children computation,
  // so that a change of the props' key set (such as `aria-invalid` appearing) never recreates them.
  const RootElement = () =>
    groupContext ? (
      <CompositeItem
        tag="span"
        render={componentProps.render}
        class={componentProps.class}
        style={componentProps.style}
        state={state}
        ref={refs}
        props={props}
        stateAttributesMapping={stateAttributesMapping}
      />
    ) : (
      renderElement('span', componentProps, {
        state,
        ref: refs,
        props,
        stateAttributesMapping,
      })
    );

  const HiddenInput = () => renderElement('input', {}, { props: inputProps });

  return (
    <RadioRootContext value={state}>
      <RootElement />
      <HiddenInput />
    </RadioRootContext>
  );
}

export interface RadioRootState extends FieldRootState {
  /**
   * Whether the radio button is currently selected.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly: boolean;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required: boolean;
  /**
   * Whether the radio button has been touched (when wrapped in Field.Root).
   */
  touched: boolean;
  /**
   * Whether the radio button's value has changed from its initial value (when wrapped in Field.Root).
   */
  dirty: boolean;
  /**
   * Whether the radio button is in a valid state (when wrapped in Field.Root).
   */
  valid: boolean | null;
  /**
   * Whether the radio button has a value (when wrapped in Field.Root).
   */
  filled: boolean;
  /**
   * Whether the radio button is focused (when wrapped in Field.Root).
   */
  focused: boolean;
}

export interface RadioRootProps<Value = any>
  extends
    NonNativeButtonProps,
    Omit<BaseUIComponentProps<'span', RadioRootState>, 'value' | 'id'> {
  /**
   * The id of the hidden input element.
   *
   * When `nativeButton` is `true`, the id is applied to the root element.
   */
  id?: string | undefined;
  /**
   * The unique identifying value of the radio in a group.
   */
  value: Value;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly?: boolean | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?: RefProp<HTMLInputElement>;
}

export namespace RadioRoot {
  export type State = RadioRootState;
  export type Props<TValue = any> = RadioRootProps<TValue>;
}
