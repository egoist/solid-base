import { createContext, useContext, type Accessor } from 'solid-js';
import type { FieldValidation } from '../field/root/createFieldValidation';
import type { CheckboxGroupParent } from './createCheckboxGroupParent';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { BaseUIEventReasons } from '../internals/reasons';
import type { LabelableContextValue } from '../internals/labelable-provider/LabelableContext';

export interface CheckboxGroupContextValue {
  value: Accessor<string[]>;
  setValue: (
    value: string[],
    eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
  ) => void;
  allValues: Accessor<string[] | undefined>;
  parent: CheckboxGroupParent;
  disabled: Accessor<boolean>;
  validation: FieldValidation;
  /**
   * `registerControlId` of the labelable scope the group renders in. A checkbox seeing the same
   * function shares that scope, so the group, not the checkbox, is the field's control.
   */
  registerControlId: LabelableContextValue['registerControlId'];
}

export const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null);

export function useCheckboxGroupContext(): CheckboxGroupContextValue | null {
  return useContext(CheckboxGroupContext);
}
