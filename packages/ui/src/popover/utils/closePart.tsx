import { createContext, createSignal, onCleanup, useContext } from 'solid-js';

interface ClosePartContextValue {
  register: () => () => void;
}

export const ClosePartContext = createContext<ClosePartContextValue | null>(null);

/**
 * Counts the `Close` parts rendered inside the popup.
 */
export function createClosePartCount() {
  const [closePartCount, setClosePartCount] = createSignal(0, { ownedWrite: true });

  const context: ClosePartContextValue = {
    register() {
      setClosePartCount((count) => count + 1);
      return () => {
        setClosePartCount((count) => Math.max(0, count - 1));
      };
    },
  };

  return {
    context,
    hasClosePart: () => closePartCount() > 0,
  };
}

/**
 * Registers a `Close` part with the enclosing popup for the lifetime of the owner.
 */
export function createClosePartRegistration() {
  const context = useContext(ClosePartContext);
  if (context) {
    onCleanup(context.register());
  }
}
