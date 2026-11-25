import { createContext, useContext, type Accessor } from 'solid-js';

export type TextDirection = 'ltr' | 'rtl';

export interface DirectionContextValue {
  readonly direction: TextDirection;
}

export const DirectionContext = createContext<DirectionContextValue | null>(null);

/**
 * Returns the reading direction provided by the closest `DirectionProvider` (`'ltr'` by default).
 */
export function useDirection(): Accessor<TextDirection> {
  const context = useContext(DirectionContext);
  return () => context?.direction ?? 'ltr';
}
