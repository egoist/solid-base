import { createEffect, createSignal, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { platform } from '@egoist/solid-base-utils/platform';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { createBaseUiId } from '../../internals/baseUiId';
import { renderElement } from '../../internals/renderElement';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { triggerStateAttributesMapping } from '../utils/stateAttributesMapping';
import type { FieldRootState } from '../../field/root/FieldRoot';
import {
  FieldRootContext,
  createDefaultFieldRootContext,
  extendFieldRootState,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import { createSetFieldFocused } from '../../internals/field-root-context/createSetFieldFocused';
import { DEFAULT_FIELD_STATE_ATTRIBUTES } from '../../internals/field-constants/constants';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useComboboxChipsContext } from '../chips/ComboboxChipsContext';
import { stopEvent } from '../../utils/popups/event';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { getHighlightReason } from '../../utils/getHighlightReason';
import type { Side } from '../../internals/anchorPositioning';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { ComboboxInternalDismissButton } from '../utils/ComboboxInternalDismissButton';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';
import {
  clickHighlightedItem,
  getChipNavigationKeys,
  useListEmpty,
  usePopupSide,
} from '../utils/parts';

/**
 * A text input to search for items in the list.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxInput(componentProps: ComboboxInput.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'disabled', 'id');

  const field = useFieldRootContext();
  const { validation } = field;
  const { labelId: fieldLabelId } = useLabelableContext();
  const comboboxChipsContext = useComboboxChipsContext();
  const positioning = useComboboxPositionerContext(true);
  const hasPositionerParent = Boolean(positioning);
  const store = useComboboxRootContext();
  const direction = useDirection();

  const inputValue = () => store.select('inputValue');
  const readOnly = () => store.select('readOnly');
  const selectionMode = () => store.select('selectionMode');
  const open = () => store.select('open');
  const inline = () => store.select('inline');

  const popupSide = usePopupSide(store);
  const disabled = () =>
    (field.disabled() ?? false) || store.select('disabled') || (componentProps.disabled ?? false);
  const listEmpty = useListEmpty();

  const setFocused = createSetFieldFocused(disabled, () => store.context.inputRef.current);

  const isInsidePopup = () => hasPositionerParent || inline();
  const focusManagerModal = () => !isInsidePopup() || store.select('modal');
  const id = createBaseUiId(
    () =>
      (componentProps.id as string | undefined) ??
      (!isInsidePopup() ? store.select('id') : undefined),
  );

  const [composingValue, setComposingValue] = createSignal<string | null>(null);
  let isComposing = false;
  let lastActiveIndex: number | null = null;

  // Restore the saved highlight on refocus only within the same open cycle. Reset on opening too:
  // the input can blur (saving the highlight) after the close was committed, such as when a
  // dialog around an inline list returns focus once it closed.
  createEffect(open, () => {
    lastActiveIndex = null;
  });

  const inputOwnsFormValue = () => selectionMode() === 'none' && !hasPositionerParent;

  function setInputElement(element: HTMLInputElement) {
    const nextIsInsidePopup = hasPositionerParent || store.state.inline;

    if (nextIsInsidePopup && !store.state.hasInputValue) {
      store.context.setInputValue('', createChangeEventDetails(REASONS.none));
    }

    store.context.inputRef.current = element;
    store.update({
      inputElement: element,
      inputInsidePopup: nextIsInsidePopup,
      inputOwnsFormValue: untrack(inputOwnsFormValue),
    });
  }

  // The displayed value is written imperatively, and only when it differs from the DOM: a
  // `value` prop is rewritten whenever the element's props re-apply, which moves the caret.
  const displayedValue = () => String(composingValue() ?? inputValue() ?? '');

  let inputElement: HTMLInputElement | null = null;
  const setInputElementRef = (element: HTMLInputElement) => {
    inputElement = element;
    setInputElement(element);
    const value = untrack(displayedValue);
    if (element.value !== value) {
      element.value = value;
    }
  };

  createEffect(displayedValue, (value) => {
    if (inputElement && inputElement.value !== value) {
      inputElement.value = value;
    }
  });
  onCleanup(() => {
    if (inputElement && store.context.inputRef.current === inputElement) {
      store.context.inputRef.current = null;
    }
    if (inputElement && store.state.inputElement === inputElement) {
      store.update({
        inputElement: null,
        inputInsidePopup: hasPositionerParent || store.state.inline,
      });
    }
  });

  function clearHighlight(event: Event) {
    store.context.setIndices({
      activeIndex: null,
      selectedIndex: null,
      type: getHighlightReason(event),
      event,
    });
  }

  const fieldStateForInput: FieldRootState = hasPositionerParent
    ? { ...DEFAULT_FIELD_STATE_ATTRIBUTES, disabled: false }
    : field.state;

  const state: ComboboxInputState = extendFieldRootState(fieldStateForInput, {
    get open() {
      return open();
    },
    get disabled() {
      return disabled();
    },
    get readOnly() {
      return readOnly();
    },
    get popupSide() {
      return popupSide();
    },
    get listEmpty() {
      return listEmpty();
    },
  });

  function getChipNavigationIndex(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (!comboboxChipsContext) {
      return undefined;
    }

    let nextIndex: number | undefined;

    const renderedChipsCount = comboboxChipsContext.chipsRef.current.length;
    const [previousChipKey] = getChipNavigationKeys(untrack(direction));
    const selectedValue = store.state.selectedValue;

    if (
      event.key === previousChipKey &&
      (event.currentTarget.selectionStart ?? 0) === 0 &&
      Array.isArray(selectedValue) &&
      selectedValue.length > 0
    ) {
      event.preventDefault();
      nextIndex = renderedChipsCount > 0 ? renderedChipsCount - 1 : undefined;
    }

    return nextIndex;
  }

  function handleInput(event: InputEvent & { currentTarget: HTMLInputElement }) {
    const input = event.currentTarget;
    // Autofill may not provide `inputType` (Chrome) or may report `insertReplacementText`
    // (Firefox).
    const inputType = event.inputType;
    const autofillLikeInput = !inputType || inputType === 'insertReplacementText';
    // During composition the input is always considered typed into.
    const shouldOpenOnInput = isComposing || !autofillLikeInput;
    const isReadOnly = store.state.readOnly;
    const isDisabled = untrack(disabled);

    function maybeOpenOnInput(trimmed: string) {
      if (isReadOnly || isDisabled || !trimmed || !shouldOpenOnInput) {
        return;
      }

      store.setOpen(true, createChangeEventDetails(REASONS.inputChange, event));
      // When autoHighlight is enabled, keep the highlight (will be set to 0 in root).
      if (!store.state.autoHighlight) {
        clearHighlight(event);
      }
    }

    // During IME composition, avoid propagating controlled updates to prevent
    // filtering the options prematurely so `Empty` won't show incorrectly.
    // We can't rely on this check for Android due to how it handles composition
    // events with some keyboards (e.g. Samsung keyboard with predictive text on
    // treats all text as always-composing).
    // https://github.com/mui/base-ui/issues/2942
    if (isComposing) {
      const nextVal = input.value;
      setComposingValue(nextVal);

      if (nextVal === '' && !store.state.openOnInputClick && !store.state.inputInsidePopup) {
        store.setOpen(false, createChangeEventDetails(REASONS.inputClear, event));
      }

      const trimmed = nextVal.trim();
      const shouldMaintainHighlight = Boolean(store.state.autoHighlight) && trimmed !== '';
      const wasOpen = store.select('open');

      maybeOpenOnInput(trimmed);

      if (wasOpen && store.state.activeIndex !== null && !shouldMaintainHighlight) {
        clearHighlight(event);
      }

      return;
    }

    const wasOpen = store.select('open');
    const inputChangeDetails = createChangeEventDetails(REASONS.inputChange, event);
    store.context.setInputValue(input.value, inputChangeDetails);

    // A controlled input that rejected the change reverts to its value.
    queueMicrotask(() => {
      if (isComposing || store.context.inputRef.current !== input) {
        return;
      }
      const currentValue = String(store.state.inputValue ?? '');
      if (input.value !== currentValue) {
        input.value = currentValue;
      }
    });

    if (inputChangeDetails.isCanceled) {
      return;
    }

    const empty = input.value === '';
    const clearDetails = createChangeEventDetails(REASONS.inputClear, event);

    if (empty && !store.state.inputInsidePopup) {
      if (store.state.selectionMode === 'single') {
        store.context.setSelectedValue(null, clearDetails);
      }

      if (!store.state.openOnInputClick) {
        store.setOpen(false, clearDetails);
      }
    }

    maybeOpenOnInput(input.value.trim());

    // When the user types, ensure the list resets its highlight so that
    // virtual focus returns to the input (aria-activedescendant is
    // cleared).
    if (wasOpen && store.state.activeIndex !== null && !store.state.autoHighlight) {
      clearHighlight(event);
    }
  }

  function handleKeyDown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
      return;
    }

    const isOpen = store.select('open');

    if (untrack(disabled) || store.state.readOnly) {
      // Browsing can highlight an item, and Enter there must not submit the form.
      if (
        store.state.readOnly &&
        event.key === 'Enter' &&
        isOpen &&
        store.state.activeIndex !== null
      ) {
        stopEvent(event);
      }
      return;
    }

    const input = event.currentTarget;
    const scrollAmount = input.scrollWidth - input.clientWidth;
    const isRTL = untrack(direction) === 'rtl';
    const mode = store.state.selectionMode;
    const selectedValue = store.state.selectedValue;

    if (event.key === 'Home') {
      stopEvent(event);
      const cursor = platform.engine.gecko && isRTL ? input.value.length : 0;
      input.setSelectionRange(cursor, cursor);
      input.scrollLeft = 0;
      return;
    }

    if (event.key === 'End') {
      stopEvent(event);
      const cursor = platform.engine.gecko && isRTL ? 0 : input.value.length;
      input.setSelectionRange(cursor, cursor);
      input.scrollLeft = isRTL ? -scrollAmount : scrollAmount;
      return;
    }

    if (!store.state.mounted && event.key === 'Escape') {
      const isClear =
        mode === 'multiple' && Array.isArray(selectedValue)
          ? selectedValue.length === 0
          : selectedValue === null;

      const details = createChangeEventDetails(REASONS.escapeKey, event);
      const value = mode === 'multiple' ? [] : null;
      store.context.setInputValue('', details);
      store.context.setSelectedValue(value, details);

      if (!isClear && !store.state.inline && !details.isPropagationAllowed) {
        event.stopPropagation();
      }

      return;
    }

    // Handle deletion when the input is empty.
    if (
      comboboxChipsContext &&
      event.key === 'Backspace' &&
      input.value === '' &&
      Array.isArray(selectedValue) &&
      selectedValue.length > 0
    ) {
      const renderedChipsCount = comboboxChipsContext.chipsRef.current.length;
      const removalIndex =
        renderedChipsCount > 0 ? renderedChipsCount - 1 : selectedValue.length - 1;

      const newValue = selectedValue.filter((_: any, index: number) => index !== removalIndex);
      // If the removed item was also the active (highlighted) item, clear highlight
      clearHighlight(event);
      store.context.setSelectedValue(newValue, createChangeEventDetails(REASONS.none, event));
      return;
    }

    const nextIndex = getChipNavigationIndex(event);

    if (nextIndex !== undefined) {
      comboboxChipsContext?.chipsRef.current[nextIndex]?.focus();
    }

    // event.isComposing
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (event.which === 229) {
      return;
    }

    // Space types into a non-empty input, and otherwise selects the highlighted item.
    if (event.key === ' ' && isOpen && input.value === '') {
      stopEvent(event);
      if (store.state.activeIndex !== null) {
        clickHighlightedItem(store, store.state.activeIndex, event);
      }
      return;
    }

    if (event.key === 'Enter' && isOpen) {
      const activeIndex = store.state.activeIndex;

      if (activeIndex === null) {
        if (store.state.inline) {
          return;
        }

        // Allow form submission when no item is highlighted.
        store.setOpen(false, createChangeEventDetails(REASONS.none, event));
        return;
      }

      stopEvent(event);
      clickHighlightedItem(store, activeIndex, event);
    }
  }

  const inputOwnProps: HTMLProps = {
    get 'aria-readonly'() {
      return readOnly() || undefined;
    },
    get 'aria-required'() {
      return store.select('required') || undefined;
    },
    get 'aria-labelledby'() {
      return fieldLabelId();
    },
    get disabled() {
      return disabled();
    },
    get readonly() {
      return readOnly();
    },
    get required() {
      return selectionMode() === 'none' ? store.select('required') : undefined;
    },
    get form() {
      return store.select('form');
    },
    get name() {
      const name = store.select('name');
      return inputOwnsFormValue() && name ? name : undefined;
    },
    get id() {
      return id();
    },
    onFocus() {
      setFocused(true);

      if (!store.state.inline) {
        return;
      }

      const nextActiveIndex = lastActiveIndex;
      lastActiveIndex = null;

      if (
        nextActiveIndex == null ||
        // `valuesRef` can be sparse, so guard against restoring a removed slot.
        !Object.hasOwn(store.context.valuesRef.current, nextActiveIndex)
      ) {
        return;
      }

      store.context.setIndices({ activeIndex: nextActiveIndex });
    },
    onBlur() {
      field.setTouched(true);
      setFocused(false);

      const activeIndex = store.state.activeIndex;
      if (store.state.inline && activeIndex !== null && store.state.autoHighlight !== 'always') {
        lastActiveIndex = activeIndex;
        store.context.setIndices({ activeIndex: null });
      }

      if (untrack(field.validationMode) === 'onBlur') {
        const valueToValidate =
          store.state.selectionMode === 'none' ? store.state.inputValue : store.state.selectedValue;
        validation.commit(valueToValidate);
      }
    },
    onCompositionStart(event: CompositionEvent & { currentTarget: HTMLInputElement }) {
      if (platform.os.android) {
        return;
      }
      isComposing = true;
      setComposingValue(event.currentTarget.value);
    },
    onCompositionEnd(event: CompositionEvent & { currentTarget: HTMLInputElement }) {
      isComposing = false;
      const next = event.currentTarget.value;
      setComposingValue(null);
      store.context.setInputValue(next, createChangeEventDetails(REASONS.inputChange, event));
    },
    onInput: handleInput,
    onKeyDown: handleKeyDown,
  };

  const InputElement = () =>
    renderElement('input', componentProps, {
      state,
      ref: setInputElementRef,
      props: [
        createDynamicPropsSource(() => store.select('inputProps')),
        createDynamicPropsSource(() => store.select('triggerProps', true)),
        inputOwnProps,
        hasPositionerParent
          ? elementProps
          : (validation.getValidationProps(disabled, elementProps as HTMLProps) as HTMLProps),
      ],
      stateAttributesMapping: triggerStateAttributesMapping,
    });

  const renderedInput = hasPositionerParent ? (
    <FieldRootContext value={createDefaultFieldRootContext()}>
      <InputElement />
    </FieldRootContext>
  ) : (
    <InputElement />
  );

  return (
    <>
      {/* Always rendered (hidden while inactive): a node appearing before the input in the same
          update as the popup would make Solid move the input, which blurs it. */}
      <ComboboxInternalDismissButton
        hidden={!(open() && focusManagerModal())}
        ref={(element) => {
          store.context.startDismissRef.current = element;
        }}
      />
      {renderedInput}
    </>
  );
}

export interface ComboboxInputState extends FieldRootState {
  /**
   * Whether the corresponding popup is open.
   */
  open: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the component should ignore user edits.
   */
  readOnly: boolean;
}

export interface ComboboxInputProps extends BaseUIComponentProps<'input', ComboboxInputState> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ComboboxInput {
  export type State = ComboboxInputState;
  export type Props = ComboboxInputProps;
}
