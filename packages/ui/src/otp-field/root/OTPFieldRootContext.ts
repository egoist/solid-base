import { createContext, useContext, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { CompositeListContextValue } from '../../internals/composite/list/CompositeList';
import type { OTPFieldRoot, OTPFieldRootState } from './OTPFieldRoot';

export interface OTPFieldRootContext {
  activeIndex: Accessor<number>;
  autoComplete: Accessor<string>;
  disabled: Accessor<boolean>;
  form: Accessor<string | undefined>;
  focusInput: (index: number) => void;
  queueFocusInput: (index: number, value: string) => void;
  getInputId: (index: number) => string | undefined;
  /**
   * Returns the index of a slot input from its current document position (`-1` when unknown).
   * Unlike the reactive slot index, it is accurate right after slots mount or unmount.
   */
  getInputIndex: (element: HTMLInputElement | null | undefined) => number;
  /**
   * Returns a guessed index (render order) for a slot whose index isn't resolved yet.
   */
  guessIndex: () => number;
  handleInputBlur: (event: FocusEvent) => void;
  handleInputFocus: (index: number, event: FocusEvent & { currentTarget: HTMLInputElement }) => void;
  inputMode: Accessor<JSX.HTMLAttributes<HTMLInputElement>['inputmode']>;
  inputAriaLabelledBy: Accessor<string | undefined>;
  invalid: Accessor<boolean | undefined>;
  length: Accessor<number>;
  list: CompositeListContextValue<{}>;
  mask: Accessor<boolean>;
  normalizeValue: Accessor<((value: string) => string) | undefined>;
  pattern: Accessor<string | undefined>;
  readOnly: Accessor<boolean>;
  registerInput: (element: HTMLInputElement) => () => void;
  reportValueInvalid: (value: string, details: OTPFieldRoot.InvalidEventDetails) => void;
  required: Accessor<boolean>;
  setFocused: (focused: boolean) => void;
  /**
   * Commits a value. Returns the committed value, or `null` when nothing changed (unchanged or
   * canceled).
   */
  setValue: (value: string, details: OTPFieldRoot.ChangeEventDetails) => string | null;
  state: OTPFieldRootState;
  validationType: Accessor<OTPFieldRoot.ValidationType>;
  value: Accessor<string>;
}

export const OTPFieldRootContext = createContext<OTPFieldRootContext | null>(null);

export function useOTPFieldRootContext(): OTPFieldRootContext {
  const context = useContext(OTPFieldRootContext);

  if (context == null) {
    throw new Error(
      'Base UI: OTPFieldRootContext is missing. OTPField parts must be placed within <OTPField.Root>.',
    );
  }

  return context;
}
