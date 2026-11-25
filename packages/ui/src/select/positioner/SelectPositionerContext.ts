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
  /**
   * Whether the popup should align the selected item with the trigger, before measuring whether
   * there is room for it.
   */
  readonly alignItemWithTriggerRequested: boolean;
  /**
   * Whether the selected item is aligned with the trigger.
   */
  readonly alignItemWithTriggerActive: boolean;
  /**
   * Positions the popup against the trigger instead, until it unmounts.
   */
  fallBackFromAlignItemWithTrigger: () => void;
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
