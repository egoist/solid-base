import { createContext, useContext, type Accessor } from 'solid-js';

/**
 * Whether the dialog portal keeps its content mounted while closed (`keepMounted`).
 */
export const DialogPortalContext = createContext<Accessor<boolean> | null>(null);

export function useDialogPortalContext() {
  const value = useContext(DialogPortalContext);
  if (value == null) {
    throw new Error('Base UI: <Dialog.Portal> is missing.');
  }
  return value;
}
