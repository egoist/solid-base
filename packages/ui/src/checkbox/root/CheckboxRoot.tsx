import {
  createEffect,
  createMemo,
  createSignal,
  merge,
  omit,
  Show,
  untrack,
} from 'solid-js';
import { createControllableSignal } from '@egoist/solid-base-utils/controlled';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import { applyRef, type RefProp } from '@egoist/solid-base-utils/refs';
import {
  visuallyHiddenInput,
  visuallyHiddenInputPinned,
} from '@egoist/solid-base-utils/visuallyHidden';
import { ownerWindow } from '@egoist/solid-base-utils/owner';
import { getDefaultFormSubmitter } from '@egoist/solid-base-utils/getDefaultFormSubmitter';
import { getCheckboxStateAttributesMapping } from '../utils/getCheckboxStateAttributesMapping';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { renderElement } from '../../internals/renderElement';
import { createBaseUiId } from '../../internals/baseUiId';
import type {
  BaseUIComponentProps,
  BaseUIEvent,
  HTMLProps,
  NonNativeButtonProps,
} from '../../internals/types';
import { mergeProps } from '../../merge-props/mergeProps';
import { createButton } from '../../internals/use-button/createButton';
import type { FieldRootState } from '../../field/root/FieldRoot';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import { createSetFieldFocused } from '../../internals/field-root-context/createSetFieldFocused';
import { createRegisterFieldControl } from '../../internals/field-register-control/createRegisterFieldControl';
import { createFieldValueChanged } from '../../internals/field-register-control/createFieldValueChanged';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { createAriaLabelledBy } from '../../internals/labelable-provider/createAriaLabelledBy';
import { createLabelableId } from '../../internals/labelable-provider/createLabelableId';
import { resolveRenderedAriaLabel } from '../../internals/resolveRenderedAriaLabel';
import { useCheckboxGroupContext } from '../../checkbox-group/CheckboxGroupContext';
import type {
  CheckboxGroupChildProps,
  CheckboxGroupParentProps,
} from '../../checkbox-group/createCheckboxGroupParent';
import { CheckboxRootContext } from './CheckboxRootContext';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';

export const PARENT_CHECKBOX = 'data-parent';

/**
 * Represents the checkbox itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Checkbox](https://base-ui.com/react/components/checkbox)
 */
export function CheckboxRoot(componentProps: CheckboxRoot.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'checked',
    'defaultChecked',
    'aria-labelledby',
    'disabled',
    'form',
    'id',
    'indeterminate',
    'inputRef',
    'name',
    'onCheckedChange',
    'parent',
    'readOnly',
    'required',
    'uncheckedValue',
    'value',
    'nativeButton',
  );

  const form = useFormContext();
  const field = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const { labelId, registerControlId, getDescriptionProps } = useLabelableContext();

  const groupContext = useCheckboxGroupContext();
  const parentContext = () =>
    groupContext && groupContext.allValues() !== undefined ? groupContext.parent : undefined;
  const isGroupedWithParent = () => parentContext() !== undefined;

  const isParent = () => componentProps.parent ?? false;
  const readOnly = () => componentProps.readOnly ?? false;
  const required = () => componentProps.required ?? false;
  const indeterminate = () => componentProps.indeterminate ?? false;
  const nativeButton = () => componentProps.nativeButton ?? false;

  const disabled = () =>
    (field.disabled() ?? false) ||
    fieldItemContext.disabled() ||
    (groupContext?.disabled() ?? false) ||
    (componentProps.disabled ?? false);
  const name = () => field.name() ?? componentProps.name;
  const value = () => componentProps.value ?? name();

  const id = createBaseUiId();

  // A `CheckboxGroup` is the field's control and takes its name from `aria-labelledby`, so the
  // checkboxes sharing its labelable scope must not claim the field's control id: they would all
  // render that one id and collide. A `Field.Item` opens a scope the checkbox does own.
  const ownsControlId = groupContext?.registerControlId !== registerControlId;

  // `|| undefined` rather than `??`: an empty `id` falls back to the scope's control id.
  const controlId = createLabelableId({
    id: () => componentProps.id || undefined,
    enabled: () => ownsControlId,
  });

  const rootId = () => (nativeButton() ? controlId() : id());

  const groupProps = createMemo(
    (): CheckboxGroupParentProps | CheckboxGroupChildProps | undefined => {
      const parent = parentContext();
      if (!parent) {
        return undefined;
      }
      if (isParent()) {
        return parent.getParentProps();
      }
      const currentValue = value();
      return currentValue !== undefined ? parent.getChildProps(currentValue) : undefined;
    },
  );

  const groupChecked = () => {
    const props = groupProps();
    return props ? props.checked : componentProps.checked;
  };
  const groupIndeterminate = () => groupProps()?.indeterminate ?? indeterminate();

  const rootRef = createRefObject<HTMLElement | null>(null);
  const setFocused = createSetFieldFocused(disabled, () => rootRef.current);

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: nativeButton,
  });

  const validation = groupContext?.validation ?? field.validation;

  const controlledChecked = () => {
    const currentValue = value();
    const groupValue = groupContext?.value();
    if (currentValue !== undefined && groupValue !== undefined && !isParent()) {
      return groupValue.includes(currentValue);
    }
    return groupChecked();
  };

  const [checked, setCheckedState] = createControllableSignal<boolean>({
    value: controlledChecked,
    defaultValue: () => componentProps.defaultChecked ?? false,
  });

  const computedChecked = () => (isGroupedWithParent() ? Boolean(groupChecked()) : checked());
  const computedIndeterminate = () =>
    isGroupedWithParent() ? groupIndeterminate() || indeterminate() : indeterminate();

  createRegisterFieldControl({
    controlRef: rootRef,
    id,
    value: checked,
    enabled: () => !groupContext && !disabled(),
    name: () => componentProps.name,
    // Inside a group, the group derives the field state from its value.
    dirty: groupContext ? undefined : () => checked() !== field.validityData().initialValue,
    filled: groupContext ? undefined : checked,
  });

  const [inputElement, setInputElement] = createSignal<HTMLInputElement | null>(null);

  // Group checkboxes register their inputs, so that the group validates and submits them all.
  createEffect(
    () => [inputElement(), isParent(), groupContext ? value() : undefined] as const,
    ([element, parent, registeredValue]) => {
      if (!element || parent) {
        return undefined;
      }
      return validation.registerInput(element, { controlRef: rootRef, value: registeredValue });
    },
  );

  const ariaLabelledBy = createAriaLabelledBy({
    explicitAriaLabelledBy: () => componentProps['aria-labelledby'] as string | undefined,
    labelId,
    labelSource: inputElement,
    enableFallback: () => !nativeButton(),
    labelSourceId: controlId,
    ariaLabel: () =>
      resolveRenderedAriaLabel(componentProps as { 'aria-label'?: string | undefined }),
  });

  createEffect(
    () => [inputElement(), computedIndeterminate(), checked()] as const,
    ([element, isIndeterminate]) => {
      if (element) {
        // Re-assert on `checked` changes too: clicking the input natively resets `indeterminate`.
        element.indeterminate = isIndeterminate;
      }
    },
  );

  if (!groupContext) {
    createFieldValueChanged(checked, (isChecked) => {
      form.clearErrors(name());
      validation.change(isChecked);
    });
  }

  createEffect(
    () => [parentContext(), disabled(), value()] as const,
    ([parent, isDisabled, currentValue]) => {
      if (!parent || currentValue === undefined) {
        return undefined;
      }

      const disabledStates = parent.disabledStates;
      disabledStates.set(currentValue, isDisabled);

      return () => {
        disabledStates.delete(currentValue);
      };
    },
  );

  const inputProps = mergeProps<HTMLProps>(
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
      // Parent checkboxes unset `name` to be excluded from form submission.
      get name() {
        return isParent() ? undefined : name();
      },
      // Set `id` to stop Chrome warning about an unassociated input.
      // When using a native button, the `id` is applied to the button instead.
      get id() {
        return nativeButton() ? undefined : controlId();
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
        const details = createChangeEventDetails(REASONS.none, event);

        componentProps.onCheckedChange?.(nextChecked, details);

        if (details.isCanceled) {
          event.preventDefault();
          return;
        }

        untrack(groupProps)?.onCheckedChange(nextChecked, details);

        if (details.isCanceled) {
          event.preventDefault();
          return;
        }

        setCheckedState(nextChecked);

        const currentValue = untrack(value);
        if (
          currentValue !== undefined &&
          groupContext &&
          !untrack(isParent) &&
          !untrack(isGroupedWithParent)
        ) {
          const groupValue = untrack(groupContext.value);
          const nextGroupValue = nextChecked
            ? [...groupValue, currentValue]
            : groupValue.filter((item) => item !== currentValue);

          groupContext.setValue(nextGroupValue, details);
        }

        // A controlled input reflects the controlled state only: revert the native toggle and
        // let the binding apply the new state, if the owner accepts the change.
        if (untrack(controlledChecked) !== undefined) {
          event.preventDefault();
        }
      },
      onFocus() {
        rootRef.current?.focus();
      },
    },
    merge(() =>
      componentProps.value !== undefined
        ? {
            value: (groupContext ? checked() && componentProps.value : componentProps.value) || '',
          }
        : {},
    ),
    getDescriptionProps,
    (props: HTMLProps) => validation.getValidationProps(disabled, props),
  );

  const state: CheckboxRootState = extendFieldRootState(field.state, {
    get checked() {
      return computedChecked();
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
    get indeterminate() {
      return computedIndeterminate();
    },
  });

  const stateAttributesMapping = getCheckboxStateAttributesMapping(state);

  const rootProps: HTMLProps = {
    get id() {
      return rootId();
    },
    role: 'checkbox',
    get 'aria-checked'() {
      return computedIndeterminate() ? 'mixed' : computedChecked();
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
    get [PARENT_CHECKBOX]() {
      return isParent() ? '' : undefined;
    },
    onFocus() {
      setFocused(true);
    },
    onBlur() {
      const element = untrack(inputElement);
      if (!element) {
        return;
      }

      field.setTouched(true);
      setFocused(false);

      if (field.validationMode() === 'onBlur') {
        validation.commit(groupContext ? untrack(groupContext.value) : element.checked);
      }
    },
    onKeyDown(event: BaseUIEvent<KeyboardEvent>) {
      if (event.key !== 'Enter') {
        return;
      }

      // Let consumer `preventDefault()` handlers opt out while defensively stopping
      // any remaining Base UI Enter handling from treating the checkbox as a button.
      event.preventBaseUIHandler();

      if (event.defaultPrevented) {
        return;
      }

      const formToSubmit = untrack(inputElement)?.form ?? null;
      const currentTarget = event.currentTarget as Element;
      const originalPreventDefault = event.preventDefault;
      let preventDefaultCalledAfterPropagation = false;

      event.preventDefault = () => {
        preventDefaultCalledAfterPropagation = true;
        originalPreventDefault.call(event);
      };

      // Enter should not activate/toggle the checkbox. Cancel the native button behavior, while
      // still letting handlers that run later in the propagation opt out of the implicit form
      // submission by calling `preventDefault()`.
      originalPreventDefault.call(event);

      ownerWindow(currentTarget).queueMicrotask(() => {
        event.preventDefault = originalPreventDefault;

        if (!preventDefaultCalledAfterPropagation) {
          getDefaultFormSubmitter(formToSubmit)?.click();
        }
      });
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

  // Only the parent checkbox gets `aria-controls` from the group.
  const otherGroupProps = merge(() => {
    const props = groupProps();
    return props && 'aria-controls' in props
      ? { 'aria-controls': props['aria-controls'] }
      : {};
  });

  // Report the rendered id to the parent checkbox (`aria-controls`).
  createEffect(
    () => {
      const parent = parentContext();
      const currentValue = value();
      if (!parent || isParent() || currentValue === undefined) {
        return undefined;
      }
      // Track the id so that a change re-registers.
      rootId();
      return [parent, currentValue] as const;
    },
    (entry) => {
      const element = rootRef.current;
      if (!entry || !element?.id) {
        return undefined;
      }
      return entry[0].registerChildId(entry[1], element.id);
    },
  );

  // Component boundaries keep the element creation untracked. Created directly in the provider's
  // children, the reads made while building the elements (such as the key set of the spread props)
  // would be tracked, and recreate the elements whenever a key appears or disappears.
  const RootElement = () =>
    renderElement('span', componentProps, {
      state,
      ref: [
        buttonRef,
        (element: HTMLElement) => {
          rootRef.current = element;
        },
      ],
      props: [
        rootProps,
        elementProps,
        otherGroupProps,
        getButtonProps,
        getDescriptionProps,
        (props: HTMLProps) => validation.getValidationProps(disabled, props),
      ],
      stateAttributesMapping,
    });

  const HiddenInput = () => renderElement('input', {}, { props: inputProps });

  return (
    <CheckboxRootContext value={state}>
      <RootElement />
      <Show
        when={
          !checked() &&
          !groupContext &&
          name() &&
          !isParent() &&
          componentProps.uncheckedValue !== undefined
        }
      >
        <input
          type="hidden"
          form={componentProps.form}
          name={name()}
          value={componentProps.uncheckedValue}
          disabled={disabled()}
        />
      </Show>
      <HiddenInput />
    </CheckboxRootContext>
  );
}

export interface CheckboxRootState extends FieldRootState {
  /**
   * Whether the checkbox is currently ticked.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   */
  readOnly: boolean;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   */
  required: boolean;
  /**
   * Whether the checkbox is in a mixed state: neither ticked, nor unticked.
   */
  indeterminate: boolean;
}

export interface CheckboxRootProps
  extends
    NonNativeButtonProps,
    Omit<BaseUIComponentProps<'span', CheckboxRootState>, 'onChange' | 'value'> {
  /**
   * The id of the input element.
   */
  id?: string | undefined;
  /**
   * Identifies the field when a form is submitted.
   * @default undefined
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the checkbox is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Whether the checkbox is currently ticked.
   *
   * To render an uncontrolled checkbox, use the `defaultChecked` prop instead.
   * @default undefined
   */
  checked?: boolean | undefined;
  /**
   * Whether the checkbox is initially ticked.
   *
   * To render a controlled checkbox, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Event handler called when the checkbox is ticked or unticked.
   */
  onCheckedChange?:
    | ((checked: boolean, eventDetails: CheckboxRootChangeEventDetails) => void)
    | undefined;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the checkbox is in a mixed state: neither ticked, nor unticked.
   * @default false
   */
  indeterminate?: boolean | undefined;
  /**
   * A ref to access the hidden `<input>` element.
   */
  inputRef?: RefProp<HTMLInputElement>;
  /**
   * Whether the checkbox controls a group of child checkboxes.
   *
   * Must be used in a [Checkbox Group](https://base-ui.com/react/components/checkbox-group).
   * @default false
   */
  parent?: boolean | undefined;
  /**
   * The value submitted with the form when the checkbox is unchecked.
   * By default, unchecked checkboxes do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
  /**
   * The checkbox's value. Identifies it within a [Checkbox Group](https://base-ui.com/react/components/checkbox-group), falling back to `name` when omitted.
   * When submitting a form, a checked box submits `value`; with no `value`, it submits the native "on".
   */
  value?: string | undefined;
}

export type CheckboxRootChangeEventReason = typeof REASONS.none;
export type CheckboxRootChangeEventDetails =
  BaseUIChangeEventDetails<CheckboxRoot.ChangeEventReason>;

export namespace CheckboxRoot {
  export type State = CheckboxRootState;
  export type Props = CheckboxRootProps;
  export type ChangeEventReason = CheckboxRootChangeEventReason;
  export type ChangeEventDetails = CheckboxRootChangeEventDetails;
}
