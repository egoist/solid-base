import { createContext, useContext, type Accessor } from 'solid-js';
import type { AccordionRoot } from './AccordionRoot';

export interface AccordionRootContextValue<Value = any> {
  disabled: Accessor<boolean>;
  handleValueChange: (
    newValue: AccordionRoot.Value<Value>[number],
    nextOpen: boolean,
    eventDetails: AccordionRoot.ChangeEventDetails,
  ) => void;
  hiddenUntilFound: Accessor<boolean>;
  keepMounted: Accessor<boolean>;
  /**
   * The live state of the root (an object of getters).
   */
  state: AccordionRoot.State<Value>;
  value: Accessor<AccordionRoot.Value<Value>>;
}

export const AccordionRootContext = createContext<AccordionRootContextValue<any> | null>(null);

export function useAccordionRootContext<Value = any>(): AccordionRootContextValue<Value> {
  const context = useContext(AccordionRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: AccordionRootContext is missing. Accordion parts must be placed within <Accordion.Root>.',
    );
  }
  return context;
}
