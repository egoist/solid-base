import { createContext, useContext, type Accessor, type Setter } from 'solid-js';
import type { AccordionItemState } from './AccordionItem';

export interface AccordionItemContextValue {
  defaultTriggerId: Accessor<string>;
  open: Accessor<boolean>;
  /**
   * The live state of the item (an object of getters).
   */
  state: AccordionItemState;
  /**
   * Registers the id of the trigger: `undefined` uses the generated fallback, `null` means the
   * trigger unmounted.
   */
  setTriggerId: Setter<string | null | undefined>;
  triggerId: Accessor<string | undefined>;
}

export const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

export function useAccordionItemContext(): AccordionItemContextValue {
  const context = useContext(AccordionItemContext);
  if (context == null) {
    throw new Error(
      'Base UI: AccordionItemContext is missing. Accordion parts must be placed within <Accordion.Item>.',
    );
  }
  return context;
}
