import { createSignal, isHydrating, onSettled, type Accessor } from 'solid-js';
import { isServer } from '@solidjs/web';

/**
 * The server can't know the visitor's locale, so format with a fixed one until hydration finishes.
 * The server markup then matches the hydration render, and the visitor's locale is applied after.
 *
 * Shared by Progress and Meter (upstream: `utils/useFormatLocale`).
 */
export function createFormatLocale(
  locale: Accessor<Intl.LocalesArgument | undefined>,
): Accessor<Intl.LocalesArgument | undefined> {
  if (isServer) {
    return () => locale() ?? 'en-US';
  }
  if (!isHydrating()) {
    return locale;
  }
  const [hydrated, setHydrated] = createSignal(false);
  onSettled(() => {
    setHydrated(true);
  });
  return () => locale() ?? (hydrated() ? undefined : 'en-US');
}
