import { createSignal, isHydrating, onSettled, type Accessor } from 'solid-js';
import { isServer } from '@solidjs/web';

/**
 * Returns whether the component is rendering before hydration completed: always `true` on the
 * server, `true` during a hydration render until it settles, and `false` for client-only renders.
 *
 * Upstream: `utils/useIsHydrating`.
 */
export function createIsHydrating(): Accessor<boolean> {
  // The same reactive structure on the server and the client, so hydration ids line up.
  const [hydrating, setHydrating] = createSignal(isServer || isHydrating());
  onSettled(() => {
    setHydrating(false);
  });
  return hydrating;
}
