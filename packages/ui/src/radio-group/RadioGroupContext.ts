import { createContext, useContext, type Accessor } from 'solid-js';
import type { FieldValidation } from '../field/root/createFieldValidation';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { BaseUIEventReasons } from '../internals/reasons';

export interface RadioGroupContextValue<Value> {
  disabled: Accessor<boolean>;
  readOnly: Accessor<boolean>;
  required: Accessor<boolean>;
  form: Accessor<string | undefined>;
  name: Accessor<string | undefined>;
  checkedValue: Accessor<Value | undefined>;
  setCheckedValue: (
    value: Value,
    eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
  ) => void;
  /**
   * Whether the focus moved through arrow keys: the radio receiving focus then gets checked.
   * Imperative (read by focus handlers right after the key press).
   */
  touched: () => boolean;
  setTouched: (touched: boolean) => void;
  validation: FieldValidation;
  /**
   * Reports a hidden input as a candidate for the group's `inputRef`. Returns the function to
   * call when the input unmounts.
   */
  registerInputRef: (element: HTMLInputElement | null) => (() => void) | undefined;
}

export const RadioGroupContext = createContext<RadioGroupContextValue<any> | null>(null);

export function useRadioGroupContext<Value = any>(): RadioGroupContextValue<Value> | null {
  return useContext(RadioGroupContext);
}
