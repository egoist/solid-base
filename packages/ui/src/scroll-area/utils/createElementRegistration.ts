import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';

/**
 * Keeps a shared `RefObject` (read imperatively by the root's measurements and gesture handlers)
 * in sync with the element a part renders, and clears it once the element is removed, either
 * because the part unmounts or because `mounted` turns `false` (the part renders nothing).
 *
 * Also returns the current element as a signal, for effects that attach listeners to it.
 */
export function createElementRegistration<T extends HTMLElement>(
  getRef: () => RefObject<T | null>,
  mounted?: Accessor<boolean>,
) {
  const [element, setElement] = createSignal<T | null>(null);
  let current: T | null = null;
  let registeredRef: RefObject<T | null> | null = null;

  function unregister() {
    if (registeredRef && registeredRef.current === current) {
      registeredRef.current = null;
    }
    registeredRef = null;
  }

  if (mounted) {
    createEffect(mounted, (isMounted) => {
      if (!isMounted) {
        unregister();
        current = null;
        setElement(null);
      }
    });
  }

  onCleanup(unregister);

  function ref(next: T) {
    unregister();
    current = next;
    registeredRef = getRef();
    registeredRef.current = next;
    setElement(() => next);
  }

  return { ref, element };
}
