import { createEffect, omit, untrack } from 'solid-js';
import { isDev } from '@solidjs/web';
import { warn } from '@egoist/solid-base-utils/warn';
import { formatNumber } from '@egoist/solid-base-utils/formatNumber';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { createSetFieldFocused } from '../../internals/field-root-context/createSetFieldFocused';
import { createRegisterFieldControl } from '../../internals/field-register-control/createRegisterFieldControl';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import {
  getNumberLocaleDetails,
  isNumeralChar,
  parseNumber,
  ANY_MINUS_RE,
  ANY_PLUS_RE,
  ANY_MINUS_DETECT_RE,
  ANY_PLUS_DETECT_RE,
  FORMAT_CONTROL_DETECT_RE,
} from '../utils/parse';
import type { NumberFieldRootState } from '../root/NumberFieldRoot';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { renderElement } from '../../internals/renderElement';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { hasNumberFormatRoundingOptions, removeFloatingPointErrors } from '../utils/validate';

const NAVIGATE_KEYS = new Set([
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'Enter',
  'Escape',
]);

/**
 * The native input control in the number field.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Number Field](https://base-ui.com/react/components/number-field)
 */
export function NumberFieldInput(componentProps: NumberFieldInput.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const {
    allowInputSyncRef,
    formatOptions,
    getAllowedNonNumericKeys,
    getStepAmount,
    id,
    form,
    incrementValue,
    inputMode,
    max,
    min,
    name,
    nameProp,
    setValue,
    state,
    setInputValue,
    locale,
    inputRef,
    onValueCommitted,
    lastChangedValueRef,
    hasPendingCommitRef,
    valueRef,
  } = useNumberFieldRootContext();

  const { clearErrors } = useFormContext();
  const field = useFieldRootContext();
  const { validation } = field;
  const { labelId } = useLabelableContext();

  const disabled = () => state.disabled;
  const readOnly = () => state.readOnly;

  const setFocused = createSetFieldFocused(disabled, () => inputRef.current);

  let blockRevalidation = false;
  let pendingCaret: number | null = null;

  createRegisterFieldControl({
    controlRef: inputRef,
    id,
    value: () => state.value,
    enabled: () => !disabled(),
    name: nameProp,
  });

  // After a paste splices text into the value, the value binding would otherwise drop the caret at
  // the end of the new value. Restore it just after the inserted text (this runs after the binding).
  createEffect(
    () => state.inputValue,
    () => {
      if (pendingCaret != null) {
        const caret = pendingCaret;
        pendingCaret = null;
        inputRef.current?.setSelectionRange(caret, caret);
      }
    },
  );

  createEffect(
    () => state.value,
    (value) => {
      clearErrors(untrack(name));

      if (blockRevalidation && !field.shouldValidateOnChange()) {
        blockRevalidation = false;
        return;
      }

      validation.change(value);
    },
    { defer: true },
  );

  const inputProps: HTMLProps = {
    get id() {
      return id();
    },
    get form() {
      return form();
    },
    get required() {
      return state.required;
    },
    get disabled() {
      return disabled();
    },
    get readonly() {
      return readOnly();
    },
    get inputmode() {
      return inputMode();
    },
    get value() {
      return state.inputValue;
    },
    type: 'text',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    'aria-roledescription': 'Number field',
    get 'aria-invalid'() {
      return !disabled() && field.invalid() ? true : undefined;
    },
    get 'aria-labelledby'() {
      return labelId();
    },
    onFocus(event: FocusEvent) {
      // Read-only inputs are still focusable; only the value-changing handlers stay gated on it.
      if (event.defaultPrevented || disabled()) {
        return;
      }

      setFocused(true);
    },
    onBlur(event: FocusEvent) {
      if (event.defaultPrevented || disabled()) {
        return;
      }

      field.setTouched(true);
      setFocused(false);

      if (readOnly()) {
        return;
      }

      const value = state.value;
      const inputValue = state.inputValue;
      const hadManualInput = !allowInputSyncRef.current;
      const hadPendingProgrammaticChange = hasPendingCommitRef.current;

      allowInputSyncRef.current = true;

      if (inputValue.trim() === '') {
        const clearDetails = createChangeEventDetails(REASONS.inputClear, event);
        setValue(null, clearDetails);
        // Respect a canceled clear, mirroring the non-empty blur path below.
        if (clearDetails.isCanceled) {
          return;
        }
        if (field.validationMode() === 'onBlur') {
          validation.commit(null);
        }
        // Don't report a commit when blurring an already-empty field that the user never
        // interacted with: nothing was cleared and no programmatic change is pending.
        if (hadManualInput || hadPendingProgrammaticChange || value !== null) {
          onValueCommitted(null, createGenericEventDetails(REASONS.inputClear, event));
        }
        return;
      }

      const currentFormat = formatOptions();

      // Without a manual edit, the visible text is purely formatted display, so keep the
      // authoritative numeric value rather than re-parsing it: rounded text discards precision,
      // and compact text (`1.2K`) can't be reversed.
      let committed = hadManualInput ? parseNumber(inputValue, locale(), currentFormat) : value;
      if (hadManualInput && committed === null) {
        return;
      }

      // Explicit rounding options apply to the committed value, whether typed or external. Avoid
      // applying Intl's default precision unless the format opts into rounding.
      if (committed !== null && hasNumberFormatRoundingOptions(currentFormat)) {
        committed = removeFloatingPointErrors(committed, currentFormat);
      }

      const nextEventDetails = createGenericEventDetails(REASONS.inputBlur, event);
      // A `NaN` value never equals itself, so don't treat it as changed on every blur
      const shouldUpdateValue = value !== committed && !Number.isNaN(committed);
      const shouldCommit = hadManualInput || shouldUpdateValue || hadPendingProgrammaticChange;

      // Use the stored value after `setValue` clamps it.
      let committedValue = committed;
      if (shouldUpdateValue) {
        const changeDetails = createChangeEventDetails(REASONS.inputBlur, event);
        blockRevalidation = true;
        setValue(committed, changeDetails);
        if (changeDetails.isCanceled) {
          blockRevalidation = false;
          return;
        }
        committedValue = lastChangedValueRef.current;
        // If validation normalized back to the current value, the value effect won't fire to
        // reset the flag, so reset it here or the next external change won't revalidate.
        if (committedValue === value) {
          blockRevalidation = false;
        }
      }
      if (field.validationMode() === 'onBlur') {
        validation.commit(committedValue);
      }
      if (shouldCommit) {
        onValueCommitted(committedValue, nextEventDetails);
      }

      // Normalize only the displayed text
      const canonicalText = formatNumber(committedValue, locale(), currentFormat);
      if (inputValue !== canonicalText) {
        setInputValue(canonicalText);
      }
    },
    onInput(event: InputEvent) {
      const input = event.currentTarget as HTMLInputElement;

      if (event.defaultPrevented) {
        // Keep the synced text, as React does for a controlled input whose change was ignored.
        input.value = state.inputValue;
        return;
      }

      const targetValue = input.value;

      if (targetValue.trim() === '') {
        allowInputSyncRef.current = false;
        setInputValue(targetValue);
        setValue(null, createChangeEventDetails(REASONS.inputClear, event));
        return;
      }

      // Update the input text immediately and only fire onValueChange if the typed value is
      // currently parseable into a number. This preserves good UX for IME
      // composition/partial input while still providing live numeric updates when possible.
      const allowedNonNumericKeys = getAllowedNonNumericKeys();
      const isValidCharacterString = Array.from(targetValue).every(
        (ch) =>
          isNumeralChar(ch) ||
          ANY_MINUS_DETECT_RE.test(ch) ||
          allowedNonNumericKeys.has(ch) ||
          // Bidi/format controls are stripped by `parseNumber`; don't let them reject the string
          // (RTL locales insert them around exponent/currency signs, e.g. scientific notation).
          FORMAT_CONTROL_DETECT_RE.test(ch),
      );

      // A rejected change leaves the synced text in place, so it doesn't count as a manual edit.
      // The DOM already holds the rejected text, so restore it (React does this for controlled
      // inputs).
      if (!isValidCharacterString) {
        input.value = state.inputValue;
        return;
      }

      allowInputSyncRef.current = false;
      const parsedValue = parseNumber(targetValue, locale(), formatOptions());

      setInputValue(targetValue);

      if (parsedValue !== null) {
        setValue(parsedValue, createChangeEventDetails(REASONS.inputChange, event));
      }
    },
    onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || readOnly() || disabled()) {
        return;
      }

      const input = event.currentTarget as HTMLInputElement;
      const inputValue = state.inputValue;

      // Snapshot the dirty state without clearing it: navigation/allowed keys (ArrowLeft, Tab,
      // Enter, Escape, …) return early without changing the value, so marking the input synced
      // here would wrongly discard dirty-input authority. Only the value-changing branches below
      // mark it synced.
      const hadManualInput = !allowInputSyncRef.current;

      const allowedNonNumericKeys = getAllowedNonNumericKeys();

      let isAllowedNonNumericKey = allowedNonNumericKeys.has(event.key);

      const { decimal, currency, percentSign } = getNumberLocaleDetails(
        locale(),
        formatOptions(),
      );

      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      const isAllSelected = selectionStart === 0 && selectionEnd === inputValue.length;

      const selectionContainsIndex = (index: number) =>
        selectionStart != null &&
        selectionEnd != null &&
        index >= selectionStart &&
        index < selectionEnd;

      // Only allow a single sign character: permit it when there is no existing sign of either
      // kind, when all text is selected, or when the selection covers the existing sign so it's
      // being replaced.
      const signGroups = [
        [ANY_MINUS_DETECT_RE, ANY_MINUS_RE],
        [ANY_PLUS_DETECT_RE, ANY_PLUS_RE],
      ] as const;
      signGroups.forEach(([detectRe, globalRe]) => {
        if (
          detectRe.test(event.key) &&
          Array.from(allowedNonNumericKeys).some((k) => detectRe.test(k))
        ) {
          const existingIndex = inputValue.search(globalRe);
          const isReplacingExisting =
            existingIndex !== -1 && selectionContainsIndex(existingIndex);
          isAllowedNonNumericKey =
            !(ANY_MINUS_DETECT_RE.test(inputValue) || ANY_PLUS_DETECT_RE.test(inputValue)) ||
            isAllSelected ||
            isReplacingExisting;
        }
      });

      // Only allow one of each symbol.
      [decimal, currency, percentSign].forEach((symbol) => {
        if (event.key === symbol) {
          const symbolIndex = inputValue.indexOf(symbol);
          const isSymbolHighlighted = selectionContainsIndex(symbolIndex);
          isAllowedNonNumericKey = symbolIndex === -1 || isAllSelected || isSymbolHighlighted;
        }
      });

      const isNavigateKey = NAVIGATE_KEYS.has(event.key);
      // Alt+ArrowUp/ArrowDown selects smallStep, so don't treat it as a bypass modifier.
      const isStepKey = event.key === 'ArrowUp' || event.key === 'ArrowDown';

      if (
        // Allow composition events (e.g., pinyin)
        // `event.isComposing` does not work in Safari:
        // https://bugs.webkit.org/show_bug.cgi?id=165004
        // React's `which` is the `keyCode` of a keydown event.
        event.keyCode === 229 ||
        (event.altKey && !isStepKey) ||
        event.ctrlKey ||
        event.metaKey ||
        isAllowedNonNumericKey ||
        isNumeralChar(event.key) ||
        isNavigateKey
      ) {
        return;
      }

      // Home/End jump to the corresponding bound, but only when that bound is defined.
      let boundaryValue: number | null = null;
      const minValue = min();
      const maxValue = max();
      if (event.key === 'Home' && minValue != null) {
        boundaryValue = minValue;
      } else if (event.key === 'End' && maxValue != null) {
        boundaryValue = maxValue;
      }

      // Let the browser handle multi-character keys we don't act on (PageUp, Insert, F-keys,
      // Home/End without min/max); invalid single characters are still blocked below.
      if (event.key.length > 1 && !isStepKey && boundaryValue === null) {
        return;
      }

      // Step from the authoritative numeric value unless the input has unsaved manual edits.
      // When the text is already synced, parsing the rounded display would collapse precision,
      // so pass no `currentValue` and let `incrementValue` fall back to the numeric state
      // (mirrors the button path).
      const currentValue = hadManualInput
        ? parseNumber(inputValue, locale(), formatOptions())
        : null;

      const amount = getStepAmount(event);

      // Prevent insertion of text or caret from moving.
      event.preventDefault();
      event.stopPropagation();

      const commitDetails = createGenericEventDetails(REASONS.keyboard, event);

      let changed = false;
      if (isStepKey || boundaryValue !== null) {
        allowInputSyncRef.current = true;
      }
      if (isStepKey) {
        // When stepping from the synced numeric state, refresh the commit ref to the current
        // value so a canceled step can't commit a stale `lastChangedValueRef` left over from an
        // earlier change (mirrors the button path).
        if (!hadManualInput) {
          lastChangedValueRef.current = valueRef.current;
        }

        changed = incrementValue(amount, {
          direction: event.key === 'ArrowUp' ? 1 : -1,
          currentValue,
          event,
          reason: REASONS.keyboard,
        });
      } else if (boundaryValue !== null) {
        changed = setValue(boundaryValue, createChangeEventDetails(REASONS.keyboard, event));
      }

      // `changed` is only true when `setValue` applied the change, which records the stored
      // (clamped/snapped) value, so commit that rather than the pre-validation input.
      if (changed) {
        onValueCommitted(lastChangedValueRef.current, commitDetails);
      }
    },
    onPaste(event: ClipboardEvent) {
      if (event.defaultPrevented || readOnly() || disabled()) {
        return;
      }

      let pastedData = '';

      try {
        pastedData = event.clipboardData?.getData('text/plain') ?? '';
      } catch {
        if (isDev) {
          warn('<NumberField.Input> could not read clipboard text during paste handling.');
        }

        return;
      }

      // Prevent the `input` event from being dispatched.
      event.preventDefault();

      // Insert the pasted text at the caret/selection instead of replacing the entire value,
      // matching native input behavior (e.g. pasting "5" into "123|" yields "1235").
      const input = event.currentTarget as HTMLInputElement;
      const inputValue = state.inputValue;
      const selectionStart = input.selectionStart!;
      const selectionEnd = input.selectionEnd!;
      const nextText =
        inputValue.slice(0, selectionStart) + pastedData + inputValue.slice(selectionEnd);

      const parsedValue = parseNumber(nextText, locale(), formatOptions());

      if (parsedValue !== null) {
        allowInputSyncRef.current = false;
        const caret = selectionStart + pastedData.length;
        pendingCaret = caret;
        setValue(parsedValue, createChangeEventDetails(REASONS.inputPaste, event));
        setInputValue(nextText);
        // Write the text now (the binding only writes it on the next flush) and place the caret.
        input.value = nextText;
        input.setSelectionRange(caret, caret);
      }
    },
  };

  return renderElement('input', componentProps, {
    ref: (element: HTMLInputElement) => {
      inputRef.current = element;
    },
    state,
    props: [
      inputProps,
      elementProps,
      (props: HTMLProps) => validation.getValidationProps(disabled, props),
    ],
    stateAttributesMapping,
  });
}

export interface NumberFieldInputState extends NumberFieldRootState {}

export interface NumberFieldInputProps extends BaseUIComponentProps<
  'input',
  NumberFieldInputState
> {
  /**
   * A user-friendly description of the input's role for assistive tech. This is a role
   * description, not an accessible name — use `Field.Label` or `aria-label` to name the control.
   * @default 'Number field'
   */
  'aria-roledescription'?: string | undefined;
}

export namespace NumberFieldInput {
  export type State = NumberFieldInputState;
  export type Props = NumberFieldInputProps;
}
