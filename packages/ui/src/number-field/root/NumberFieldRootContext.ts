import { createContext, useContext, type Accessor } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { NumberFieldRoot, NumberFieldRootState } from './NumberFieldRoot';
import type { EventWithOptionalKeyState, IncrementValueParameters } from '../utils/types';

export type InputMode = 'numeric' | 'decimal' | 'text';

export interface NumberFieldRootContext {
  minWithDefault: Accessor<number>;
  maxWithDefault: Accessor<number>;
  id: Accessor<string | undefined>;
  form: Accessor<string | undefined>;
  setValue: (value: number | null, details: NumberFieldRoot.ChangeEventDetails) => boolean;
  getStepAmount: (event?: EventWithOptionalKeyState) => number;
  incrementValue: (amount: number, params: IncrementValueParameters) => boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  focusInput: () => void;
  allowInputSyncRef: RefObject<boolean>;
  formatOptions: Accessor<Intl.NumberFormatOptions | undefined>;
  /**
   * The current numeric value, readable synchronously after it was written in the same event.
   */
  valueRef: RefObject<number | null>;
  lastChangedValueRef: RefObject<number | null>;
  hasPendingCommitRef: RefObject<boolean>;
  name: Accessor<string | undefined>;
  nameProp: Accessor<string | undefined>;
  inputMode: Accessor<InputMode>;
  getAllowedNonNumericKeys: () => Set<string>;
  min: Accessor<number | undefined>;
  max: Accessor<number | undefined>;
  setInputValue: (value: string) => void;
  locale: Accessor<Intl.LocalesArgument | undefined>;
  setIsScrubbing: (scrubbing: boolean) => void;
  state: NumberFieldRootState;
  onValueCommitted: (
    value: number | null,
    eventDetails: NumberFieldRoot.CommitEventDetails,
  ) => void;
}

export const NumberFieldRootContext = createContext<NumberFieldRootContext | null>(null);

export function useNumberFieldRootContext(): NumberFieldRootContext {
  const context = useContext(NumberFieldRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: NumberFieldRootContext is missing. NumberField parts must be placed within <NumberField.Root>.',
    );
  }

  return context;
}
