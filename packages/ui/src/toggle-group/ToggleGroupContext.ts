import { createContext, useContext } from 'solid-js';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { BaseUIEventReasons } from '../internals/reasons';

export interface ToggleGroupContextValue<Value> {
  readonly value: readonly Value[];
  setGroupValue: (
    newValue: Value,
    nextPressed: boolean,
    eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
  ) => void;
  readonly disabled: boolean;
  /**
   * Indicates whether the value has been initialized via `value` or `defaultValue` props.
   * Used to determine if Toggle should warn users about data inconsistency problems.
   */
  readonly isValueInitialized: boolean;
}

export const ToggleGroupContext = createContext<ToggleGroupContextValue<any> | null>(null);

export function useToggleGroupContext<Value>() {
  return useContext(ToggleGroupContext) as ToggleGroupContextValue<Value> | null;
}
