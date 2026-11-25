import { createContext, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { Align, Side } from '../../internals/anchorPositioning';

/**
 * The positioning of the select popup, shared with the parts inside the positioner.
 * A live object: its getters are reactive.
 */
export interface SelectPositionerContext {
  readonly side: 'none' | Side;
  readonly align: Align;
  readonly arrowStyles: JSX.CSSProperties;
  arrowRef: (element: Element | null) => void;
  readonly arrowUncentered: boolean;
  readonly isPositioned: boolean;
  readonly alignItemWithTriggerActive: boolean;
  setControlledAlignItemWithTrigger: (value: boolean) => void;
  scrollUpArrowRef: RefObject<HTMLDivElement | null>;
  scrollDownArrowRef: RefObject<HTMLDivElement | null>;
}

export const SelectPositionerContext = createContext<SelectPositionerContext | null>(null);

export function useSelectPositionerContext(): SelectPositionerContext {
  const context = useContext(SelectPositionerContext);
  if (context == null) {
    throw new Error(
      'Base UI: SelectPositionerContext is missing. SelectPositioner parts must be placed within <Select.Positioner>.',
    );
  }
  return context;
}
