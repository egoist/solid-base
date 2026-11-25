import {
  createEffect,
  createRenderEffect,
  createSignal,
  merge,
  omit,
  onCleanup,
  untrack,
} from 'solid-js';
import { isDev, isServer } from '@solidjs/web';
import { warn } from '@egoist/solid-base-utils/warn';
import { platform } from '@egoist/solid-base-utils/platform';
import { stopEvent } from '../../utils/popups/event';
import { useCompositeListItem } from '../../internals/composite/list/CompositeList';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { createSetFieldFocused } from '../../internals/field-root-context/createSetFieldFocused';
import { renderElement } from '../../internals/renderElement';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useOTPFieldRootContext } from '../root/OTPFieldRootContext';
import type { OTPFieldRootState } from '../root/OTPFieldRoot';
import { inputStateAttributesMapping } from '../utils/stateAttributesMapping';
import { normalizeOTPValueWithDetails, removeOTPCharacter, replaceOTPValue } from '../utils/otp';

type InputEventTarget = { currentTarget: HTMLInputElement };

/**
 * An individual OTP character input.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI OTP Field](https://base-ui.com/react/components/otp-field)
 */
export function OTPFieldInput(componentProps: OTPFieldInput.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'aria-label',
    'aria-labelledby',
  );

  const root = useOTPFieldRootContext();
  const { ref: listItemRef, index: listIndex } = useCompositeListItem({ list: root.list });
  // Until the list resolves document positions (a microtask after mount), use the render order.
  const guessedIndex = root.guessIndex();
  const index = () => {
    const resolved = listIndex();
    return resolved === -1 ? guessedIndex : resolved;
  };

  let inputElement: HTMLInputElement | null = null;
  let unregisterInput: (() => void) | undefined;

  const setFocused = createSetFieldFocused(root.disabled, () => inputElement, root.setFocused);
  const direction = useDirection();

  // While an IME composition is active, Safari exposes the in-progress text through `input`
  // as an accumulating string (`d`, then `dd`, then `ddd`). Committing those intermediate values
  // would treat them as bulk input and fill too many slots, so the text is only buffered here
  // and committed once on `compositionend`. The handlers read the plain variable (signal reads
  // lag writes); the signal renders the buffered text.
  let composing: string | null = null;
  const [composingValue, setComposingValue] = createSignal<string | null>(null);

  function setComposing(next: string | null) {
    composing = next;
    setComposingValue(next);
  }

  const slotValue = () => root.value()[index()] ?? '';
  const displayValue = () => composingValue() ?? slotValue();

  // The DOM value is written only when it differs: re-writing an equal value (as a `value` binding
  // does whenever the spread re-applies, e.g. when `tabindex` moves) resets the selection that
  // focusing a slot just made.
  createRenderEffect(displayValue, (nextValue) => {
    if (inputElement && inputElement.value !== nextValue) {
      inputElement.value = nextValue;
    }
  });

  // Handlers resolve the slot index from the document order at call time, so they stay accurate
  // right after sibling slots mount or unmount.
  function currentIndex() {
    const domIndex = root.getInputIndex(inputElement);
    return domIndex === -1 ? untrack(index) : domIndex;
  }

  function currentSlotValue(slotIndex: number) {
    return untrack(root.value)[slotIndex] ?? '';
  }

  const ariaLabel = () => (index() === 0 ? undefined : componentProps['aria-label']);
  const inheritedLabel = () => componentProps['aria-labelledby'] ?? root.inputAriaLabelledBy();

  if (isDev) {
    createEffect(
      () => [index(), componentProps['aria-label']] as const,
      ([slotIndex, slotAriaLabel]) => {
        if (slotIndex !== 0 || slotAriaLabel == null || inputElement?.labels?.length) {
          return;
        }
        warn(
          '<OTPField.Input> ignores `aria-label` on the first input. Use a `<label>` or `<Field.Label>` to label the OTP field.',
        );
      },
    );
  }

  onCleanup(() => {
    unregisterInput?.();
  });

  function commitValue(
    rawValue: string,
    reason: typeof REASONS.inputChange | typeof REASONS.inputPaste,
    event: Event & InputEventTarget,
  ) {
    const length = root.length();
    const validationType = root.validationType();
    const normalizeValue = root.normalizeValue();
    const value = untrack(root.value);
    const slotIndex = currentIndex();
    const slot = currentSlotValue(slotIndex);

    const [nextDigits, didRejectCharacters] = normalizeOTPValueWithDetails(
      rawValue,
      length,
      validationType,
      normalizeValue,
    );

    if (didRejectCharacters) {
      root.reportValueInvalid(rawValue, createGenericEventDetails(reason, event));
    }

    if (nextDigits === '') {
      // Typed input edits the slot in place: clear it, or restore its character when every
      // typed character was rejected. An empty or fully rejected paste changes nothing.
      if (reason === REASONS.inputChange) {
        if (rawValue === '') {
          root.setValue(
            removeOTPCharacter(value, slotIndex),
            createChangeEventDetails(REASONS.inputClear, event),
          );
        } else if (slot !== '') {
          event.currentTarget.value = slot;
          event.currentTarget.select();
        }
      }
      return;
    }

    const committedValue = root.setValue(
      replaceOTPValue(value, slotIndex, nextDigits, length, validationType, normalizeValue),
      createChangeEventDetails(reason, event),
    );

    if (committedValue != null) {
      root.queueFocusInput(Math.min(slotIndex + nextDigits.length, length - 1), committedValue);
    }
  }

  const inputProps: HTMLProps = {
    get id() {
      return root.getInputId(index());
    },
    get type() {
      return root.mask() ? 'password' : 'text';
    },
    get inputmode() {
      return root.inputMode();
    },
    get autocomplete() {
      return index() === 0 ? root.autoComplete() : 'off';
    },
    autocorrect: 'off',
    spellcheck: 'false',
    get enterkeyhint() {
      return index() === root.length() - 1 ? 'done' : 'next';
    },
    // Only the first slot has a max length to avoid password manager bubbles appearing after
    // later inputs.
    get maxlength() {
      return index() === 0 ? root.length() : undefined;
    },
    get tabindex() {
      return root.activeIndex() === index() ? 0 : -1;
    },
    get disabled() {
      return root.disabled();
    },
    get form() {
      return root.form();
    },
    get pattern() {
      return root.pattern();
    },
    get readonly() {
      return root.readOnly();
    },
    get required() {
      return root.required();
    },
    get 'aria-labelledby'() {
      return ariaLabel() == null ? inheritedLabel() : undefined;
    },
    get 'aria-invalid'() {
      return !root.disabled() && root.invalid() ? true : undefined;
    },
    get 'aria-label'() {
      return ariaLabel();
    },
    onMouseDown(event: MouseEvent) {
      if (event.defaultPrevented || root.disabled()) {
        return;
      }

      event.preventDefault();
      root.focusInput(currentIndex());
    },
    onFocus(event: FocusEvent & InputEventTarget) {
      if (event.defaultPrevented || root.disabled()) {
        return;
      }

      setFocused(true);
      root.handleInputFocus(currentIndex(), event);
    },
    onBlur(event: FocusEvent) {
      if (event.defaultPrevented) {
        return;
      }

      // Focus moving to a sibling slot stays inside the root; `handleInputBlur` clears the
      // focused state only when focus leaves the root, so slot-to-slot moves don't churn it.
      root.handleInputBlur(event);
    },
    onCompositionStart() {
      // Some Android keyboards report all text as always-composing, so Android keeps
      // committing through `input`.
      if (!platform.os.android) {
        setComposing(currentSlotValue(currentIndex()));
      }
    },
    onCompositionEnd(event: CompositionEvent & InputEventTarget) {
      if (composing == null) {
        return;
      }

      setComposing(null);
      const rawValue = event.currentTarget.value;
      // The DOM mirrors the committed slot value; an accepted change re-renders it.
      event.currentTarget.value = currentSlotValue(currentIndex());

      if (!root.disabled() && !root.readOnly()) {
        commitValue(rawValue, REASONS.inputChange, event);
      }
    },
    onInput(event: InputEvent & InputEventTarget) {
      const input = event.currentTarget;
      const rawValue = input.value;

      if (composing != null) {
        setComposing(rawValue);
        return;
      }

      // The DOM mirrors the committed slot value; an accepted change re-renders it.
      input.value = currentSlotValue(currentIndex());

      if (event.defaultPrevented || root.disabled() || root.readOnly()) {
        return;
      }

      commitValue(rawValue, REASONS.inputChange, event);
    },
    onKeyDown(event: KeyboardEvent & InputEventTarget) {
      // Browsers deliver real key names (such as `Backspace`) for keydowns inside a composition.
      // The IME owns editing until `compositionend`, so OTP commands must not run on them.
      if (event.defaultPrevented || root.disabled() || composing != null) {
        return;
      }

      const length = root.length();
      const value = untrack(root.value);
      const slotIndex = currentIndex();
      const slot = currentSlotValue(slotIndex);
      const firstIndex = 0;
      const lastIndex = Math.max(length - 1, firstIndex);
      const endTargetIndex = Math.min(value.length, lastIndex);
      const hasBoundaryModifier = (event.ctrlKey || event.metaKey) && !event.altKey;
      const isRtl = direction() === 'rtl';
      const previousKey = isRtl ? 'ArrowRight' : 'ArrowLeft';
      const nextKey = isRtl ? 'ArrowLeft' : 'ArrowRight';

      if (event.key === previousKey) {
        stopEvent(event);
        root.focusInput(hasBoundaryModifier ? firstIndex : Math.max(firstIndex, slotIndex - 1));
        return;
      }

      if (event.key === nextKey) {
        stopEvent(event);
        root.focusInput(
          hasBoundaryModifier ? endTargetIndex : Math.min(lastIndex, slotIndex + 1),
        );
        return;
      }

      if (event.key === 'Home' || event.key === 'ArrowUp') {
        stopEvent(event);
        root.focusInput(firstIndex);
        return;
      }

      if (event.key === 'End' || event.key === 'ArrowDown') {
        stopEvent(event);
        root.focusInput(endTargetIndex);
        return;
      }

      if (root.readOnly()) {
        return;
      }

      function setKeyboardValue(nextValue: string, targetIndex: number) {
        const committedValue = root.setValue(
          nextValue,
          createChangeEventDetails(REASONS.keyboard, event),
        );

        if (committedValue != null) {
          root.queueFocusInput(targetIndex, committedValue);
        }
      }

      if (event.key === 'Backspace' && hasBoundaryModifier) {
        stopEvent(event);
        setKeyboardValue('', firstIndex);
        return;
      }

      if (event.key === 'Delete') {
        stopEvent(event);
        setKeyboardValue(removeOTPCharacter(value, slotIndex), slotIndex);
        return;
      }

      const inputValue = event.currentTarget.value;
      const fullSelection =
        event.currentTarget.selectionStart === 0 &&
        event.currentTarget.selectionEnd === inputValue.length;

      if (event.key.length === 1 && fullSelection && slot === event.key) {
        stopEvent(event);
        if (slotIndex < length - 1) {
          root.focusInput(slotIndex + 1);
        }
        return;
      }

      if (event.key === 'Backspace') {
        stopEvent(event);
        const targetIndex = Math.max(firstIndex, slotIndex - 1);
        const deleteIndex = slot === '' ? targetIndex : slotIndex;
        setKeyboardValue(removeOTPCharacter(value, deleteIndex), targetIndex);
      }
    },
    onPaste(event: ClipboardEvent & InputEventTarget) {
      if (event.defaultPrevented || root.disabled() || root.readOnly()) {
        return;
      }

      let rawValue = '';

      try {
        rawValue = event.clipboardData?.getData('text/plain') ?? '';
      } catch {
        if (isDev) {
          warn('<OTPField.Input> could not read clipboard text during paste handling.');
        }
        return;
      }

      event.preventDefault();
      commitValue(rawValue, REASONS.inputPaste, event);
    },
  };

  const state: OTPFieldInputState = merge(root.state, {
    get value() {
      return slotValue();
    },
    get index() {
      return index();
    },
    get filled() {
      return slotValue() !== '';
    },
  }) as OTPFieldInputState;

  return renderElement('input', componentProps, {
    ref: [
      listItemRef,
      (element: HTMLInputElement) => {
        if (inputElement !== element) {
          unregisterInput?.();
          inputElement = element;
          element.value = untrack(displayValue);
          unregisterInput = root.registerInput(element);
        }
      },
    ],
    state,
    // On the server the value can only be rendered as an attribute.
    props: [
      inputProps,
      isServer && {
        get value() {
          return displayValue();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: inputStateAttributesMapping,
  });
}

export interface OTPFieldInputState extends Omit<OTPFieldRootState, 'filled' | 'value'> {
  /**
   * Whether this input contains a character.
   */
  filled: boolean;
  /**
   * The input index.
   */
  index: number;
  /**
   * The character rendered in this slot.
   */
  value: string;
}

export interface OTPFieldInputProps extends BaseUIComponentProps<'input', OTPFieldInputState> {}

export namespace OTPFieldInput {
  export type State = OTPFieldInputState;
  export type Props = OTPFieldInputProps;
}
