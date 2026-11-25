import { createContext, useContext } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';

/**
 * A live object: its getters are reactive.
 */
export interface SelectItemContext {
  readonly selected: boolean;
  readonly index: number;
  textRef: RefObject<HTMLElement | null>;
  readonly selectedByFocus: boolean;
}

export const SelectItemContext = createContext<SelectItemContext | null>(null);

export function useSelectItemContext(): SelectItemContext {
  const context = useContext(SelectItemContext);
  if (context == null) {
    throw new Error(
      'Base UI: SelectItemContext is missing. SelectItem parts must be placed within <Select.Item>.',
    );
  }
  return context;
}
