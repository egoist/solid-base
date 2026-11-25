import { createSignal, isHydrating, onSettled, type Accessor } from 'solid-js';
import { isServer } from '@solidjs/web';

/**
 * Returns whether the component is rendering before hydration completed: always `true` on the
 * server, `true` during a hydration render until it settles, and `false` for client-only renders.
 *
 * Upstream: `utils/useIsHydrating`.
 */
export function createIsHydrating(): Accessor<boolean> {
  if (isServer) {
    return () => true;
  }
  if (!isHydrating()) {
    return () => false;
  }
  const [hydrating, setHydrating] = createSignal(true);
  onSettled(() => {
    setHydrating(false);
  });
  return hydrating;
}
