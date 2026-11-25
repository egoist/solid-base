import { createContext, useContext, type Accessor } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';

export interface NumberFieldScrubAreaContext {
  isScrubbing: Accessor<boolean>;
  isTouchInput: Accessor<boolean>;
  isPointerLockDenied: Accessor<boolean>;
  scrubAreaCursorRef: RefObject<HTMLSpanElement | null>;
}

export const NumberFieldScrubAreaContext = createContext<NumberFieldScrubAreaContext | null>(null);

export function useNumberFieldScrubAreaContext(): NumberFieldScrubAreaContext {
  const context = useContext(NumberFieldScrubAreaContext);
  if (context == null) {
    throw new Error(
      'Base UI: NumberFieldScrubAreaContext is missing. NumberFieldScrubArea parts must be placed within <NumberField.ScrubArea>.',
    );
  }
  return context;
}
