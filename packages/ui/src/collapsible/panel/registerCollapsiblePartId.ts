import { createEffect, type Accessor, type Setter } from 'solid-js';

/**
 * Registers the explicit `id` of a part (panel or trigger) with its owner, so the other parts can
 * reference it. `undefined` falls back to the generated id; `null` means the part unmounted.
 */
export function registerCollapsiblePartId(
  registeredId: Accessor<string | undefined>,
  setIdState: Setter<string | null | undefined>,
) {
  createEffect(registeredId, (id) => {
    setIdState((currentId) => id ?? (currentId === null ? undefined : currentId));
    return () => {
      setIdState((currentId) => (currentId === id ? null : currentId));
    };
  });
}
