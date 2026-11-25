import { createContext, useContext } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';

export interface ComboboxChipsContext {
  chipsRef: RefObject<Array<HTMLElement | null>>;
}

export const ComboboxChipsContext = createContext<ComboboxChipsContext | null>(null);

export function useComboboxChipsContext() {
  return useContext(ComboboxChipsContext);
}
