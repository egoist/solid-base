import { createEffect, createSignal, merge, omit, onCleanup, Show, untrack } from 'solid-js';
import { createControllableSignal } from '@egoist/solid-base-utils/controlled';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import { applyRef, type RefProp } from '@egoist/solid-base-utils/refs';
import {
  visuallyHiddenInput,
  visuallyHiddenInputPinned,
} from '@egoist/solid-base-utils/visuallyHidden';
import { renderElement } from '../../internals/renderElement';
import type {
  BaseUIComponentProps,
  HTMLProps,
  NonNativeButtonProps,
} from '../../internals/types';
import { createBaseUiId } from '../../internals/baseUiId';
import { createButton } from '../../internals/use-button/createButton';
import { SwitchRootContext } from './SwitchRootContext';
import { stateAttributesMapping } from '../stateAttributesMapping';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import type { FieldRootState } from '../../field/root/FieldRoot';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import { createSetFieldFocused } from '../../internals/field-root-context/createSetFieldFocused';
import { createRegisterFieldControl } from '../../internals/field-register-control/createRegisterFieldControl';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { createAriaLabelledBy } from '../../internals/labelable-provider/createAriaLabelledBy';
import { createLabelableId } from '../../internals/labelable-provider/createLabelableId';
import { resolveRenderedAriaLabel } from '../../internals/resolveRenderedAriaLabel';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import { mergeProps } from '../../merge-props/mergeProps';

/**
 * Represents the switch itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Switch](https://base-ui.com/react/components/switch)
 */
export function SwitchRoot(componentProps: SwitchRoot.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'checked',
    'defaultChecked',
    'aria-labelledby',
    'form',
    'id',
    'inputRef',
    'name',
    'nativeButton',
    'onCheckedChange',
    'readOnly',
    'required',
    'disabled',
    'uncheckedValue',
    'value',
  );

  const form = useFormContext();
  const field = useFieldRootContext();
  const { validation } = field;
  const { labelId } = useLabelableContext();

  const disabled = () => (field.disabled() ?? false) || (componentProps.disabled ?? false);
  const readOnly = () => componentProps.readOnly ?? false;
  const required = () => componentProps.required ?? false;
  const nativeButton = () => componentProps.nativeButton ?? false;
  const name = () => field.name() ?? componentProps.name;

  const [inputElement, setInputElement] = createSignal<HTMLInputElement | null>(null);
  const switchRef = createRefObject<HTMLElement | null>(null);
  const setFocused = createSetFieldFocused(disabled, () => switchRef.current);

  const id = createBaseUiId();

  const controlId = createLabelableId({ id: () => componentProps.id });
  const hiddenInputId = () => (nativeButton() ? undefined : controlId());

  const isControlled = () => componentProps.checked !== undefined;
  const [checked, setCheckedState] = createControllableSignal<boolean>({
    value: () => componentProps.checked,
    defaultValue: () => Boolean(componentProps.defaultChecked),
  });

  createRegisterFieldControl({
    controlRef: switchRef,
    id,
    value: checked,
    enabled: () => !disabled(),
    name: () => componentProps.name,
  });

  createEffect(checked, (value) => {
    field.setFilled(value);
  });

  createEffect(
    checked,
    (value) => {
      untrack(() => {
        form.clearErrors(name());
        field.setDirty(value !== field.validityData().initialValue);
      });

      validation.change(value);
    },
    { defer: true },
  );

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: nativeButton,
  });

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
    get id() {
      return nativeButton() ? controlId() : id();
    },
    role: 'switch',
    get 'aria-checked'() {
      return checked();
    },
    get 'aria-readonly'() {
      return readOnly() || undefined;
    },
    get 'aria-required'() {
      return required() || undefined;
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
    onFocus() {
      setFocused(true);
    },
    onBlur() {
      const element = untrack(inputElement);
      if (!element || disabled()) {
        return;
      }

      field.setTouched(true);
      setFocused(false);

      if (field.validationMode() === 'onBlur') {
        validation.commit(element.checked);
      }
    },
    onClick(event: MouseEvent) {
      if (readOnly() || disabled()) {
        return;
      }

      event.preventDefault();

      const input = untrack(inputElement);
      if (!input) {
        return;
      }

      dispatchClickWithModifiers(input, event);
    },
  };

  const inputProps = mergeProps<HTMLProps>(
    validation.getValidationProps(disabled),
    {
      type: 'checkbox',
      'aria-hidden': 'true',
      tabindex: -1,
      get checked() {
        return checked();
      },
      get disabled() {
        return disabled();
      },
      get form() {
        return componentProps.form;
      },
      get id() {
        return hiddenInputId();
      },
      get name() {
        return name();
      },
      get required() {
        return required();
      },
      get style() {
        return name() ? visuallyHiddenInput : visuallyHiddenInputPinned;
      },
      onInvalid: handleHiddenInputInvalid,
      ref(element: HTMLInputElement) {
        setInputElement(element);
        validation.inputRef.current = element;
        applyRef(componentProps.inputRef, element);
      },
      // The hidden input toggles natively when clicked (by the root, a label, or directly).
      // The state change is handled on `click`, where it can still be canceled: preventing the
      // click's default reverts the native toggle.
      onClick(event: MouseEvent) {
        // The click dispatched from the root's `onClick` is an implementation detail
        // and must not reach ancestors, which already receive the original click.
        event.stopPropagation();

        if (event.defaultPrevented) {
          return;
        }

        if (readOnly()) {
          event.preventDefault();
          return;
        }

        const nextChecked = (event.currentTarget as HTMLInputElement).checked;
        const eventDetails = createChangeEventDetails(REASONS.none, event);

        componentProps.onCheckedChange?.(nextChecked, eventDetails);

        if (eventDetails.isCanceled) {
          event.preventDefault();
          return;
        }

        setCheckedState(nextChecked);

        // A controlled input reflects the `checked` prop only: revert the native toggle and let
        // the binding apply the new prop, if the owner accepts the change.
        if (isControlled()) {
          event.preventDefault();
        }
      },
      onFocus() {
        switchRef.current?.focus();
      },
    },
    merge(() =>
      componentProps.value !== undefined ? { value: componentProps.value } : {},
    ),
  );

  onCleanup(() => {
    if (validation.inputRef.current === untrack(inputElement)) {
      validation.inputRef.current = null;
    }
  });

  const state: SwitchRootState = extendFieldRootState(field.state, {
    get checked() {
      return checked();
    },
    get disabled() {
      return disabled();
    },
    get readOnly() {
      return readOnly();
    },
    get required() {
      return required();
    },
  });

  // Component boundaries keep the element creation untracked. Created directly in the provider's
  // children, the reads made while building the elements (such as the key set of the spread props)
  // would be tracked, and recreate the elements whenever a key appears or disappears.
  const RootElement = () =>
    renderElement('span', componentProps, {
      state,
      ref: [
        (element: HTMLElement) => {
          switchRef.current = element;
        },
        buttonRef,
      ],
      props: [
        rootProps,
        elementProps,
        getButtonProps,
        (props: HTMLProps) => validation.getValidationProps(disabled, props),
      ],
      stateAttributesMapping,
    });

  const HiddenInput = () => renderElement('input', {}, { props: inputProps });

  return (
    <SwitchRootContext value={state}>
      <RootElement />
      <Show when={!checked() && name() && componentProps.uncheckedValue !== undefined}>
        <input
          type="hidden"
          form={componentProps.form}
          name={name()}
          value={componentProps.uncheckedValue}
          disabled={disabled()}
        />
      </Show>
      <HiddenInput />
    </SwitchRootContext>
  );
}

export interface SwitchRootState extends FieldRootState {
  /**
   * Whether the switch is currently active.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   */
  readOnly: boolean;
  /**
   * Whether the user must activate the switch before submitting a form.
   */
  required: boolean;
}

export interface SwitchRootProps
  extends
    NonNativeButtonProps,
    Omit<BaseUIComponentProps<'span', SwitchRootState>, 'onChange' | 'value'> {
  /**
   * The id of the hidden input element.
   *
   * When `nativeButton` is `true`, the id is applied to the root element.
   */
  id?: string | undefined;
  /**
   * Whether the switch is currently active.
   *
   * To render an uncontrolled switch, use the `defaultChecked` prop instead.
   */
  checked?: boolean | undefined;
  /**
   * Whether the switch is initially active.
   *
   * To render a controlled switch, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A ref to access the hidden `<input>` element.
   */
  inputRef?: RefProp<HTMLInputElement>;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the switch is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Event handler called when the switch is activated or deactivated.
   */
  onCheckedChange?:
    | ((checked: boolean, eventDetails: SwitchRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must activate the switch before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * The value submitted with the form when the switch is on.
   * By default, switch submits the "on" value, matching native checkbox behavior.
   */
  value?: string | undefined;
  /**
   * The value submitted with the form when the switch is off.
   * By default, unchecked switches do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
}

export type SwitchRootChangeEventReason = typeof REASONS.none;
export type SwitchRootChangeEventDetails = BaseUIChangeEventDetails<SwitchRoot.ChangeEventReason>;

export namespace SwitchRoot {
  export type State = SwitchRootState;
  export type Props = SwitchRootProps;
  export type ChangeEventReason = SwitchRootChangeEventReason;
  export type ChangeEventDetails = SwitchRootChangeEventDetails;
}
