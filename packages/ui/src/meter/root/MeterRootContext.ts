import { createContext, useContext } from 'solid-js';

export interface MeterRootContext {
  /**
   * The value clamped to the range.
   */
  readonly clampedValue: number;
  readonly format: Intl.NumberFormatOptions | undefined;
  readonly locale: Intl.LocalesArgument | undefined;
  /**
   * The value normalized to a `0`–`100` percentage of the range, clamped to those bounds.
   */
  readonly percentageValue: number;
  setLabelId: (updater: (currentId: string | undefined) => string | undefined) => void;
  readonly value: number;
}

export const MeterRootContext = createContext<MeterRootContext | null>(null);

export function useMeterRootContext() {
  const context = useContext(MeterRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: MeterRootContext is missing. Meter parts must be placed within <Meter.Root>.',
    );
  }

  return context;
}
