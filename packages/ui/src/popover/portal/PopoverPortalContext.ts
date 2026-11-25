import { createContext, useContext, type Accessor } from 'solid-js';

/**
 * Whether the popover portal keeps its content mounted while closed (`keepMounted`).
 */
export const PopoverPortalContext = createContext<Accessor<boolean> | null>(null);

export function usePopoverPortalContext() {
  const value = useContext(PopoverPortalContext);
  if (value == null) {
    throw new Error('Base UI: <Popover.Portal> is missing.');
  }
  return value;
}
