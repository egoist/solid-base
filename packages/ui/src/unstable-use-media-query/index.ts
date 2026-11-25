import {
  createEffect,
  createMemo,
  createSignal,
  isHydrating,
  onSettled,
  type Accessor,
} from 'solid-js';
import { isServer } from '@solidjs/web';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';

/**
 * Tracks whether a media query matches.
 *
 * @param query The media query, with or without the leading `@media`. Can be an accessor.
 * @param options The options. They are read lazily, so they can be getters.
 * @returns An accessor of whether the query matches.
 */
export function useMediaQuery(
  query: string | Accessor<string>,
  options: useMediaQuery.Options = {},
): Accessor<boolean> {
  const resolvedQuery = () =>
    (typeof query === 'function' ? query() : query).replace(/^@media( ?)/m, '');

  const defaultMatches = () => options.defaultMatches ?? false;

  const matchMedia = (): typeof window.matchMedia | null => {
    if (options.matchMedia !== undefined) {
      return options.matchMedia;
    }
    // Wait for jsdom to support the match media feature.
    // All the browsers Base UI support have this built-in.
    // This defensive check is here for simplicity.
    // Most of the time, the match media logic isn't central to people's tests.
    return typeof window !== 'undefined' && typeof window.matchMedia !== 'undefined'
      ? window.matchMedia
      : null;
  };

  // The value rendered on the server, and on the client until hydration completes.
  const getServerSnapshot = () => {
    const match = matchMedia();
    if (options.noSsr && match) {
      return match(resolvedQuery()).matches;
    }
    if (options.ssrMatchMedia != null) {
      return options.ssrMatchMedia(resolvedQuery()).matches;
    }
    return defaultMatches();
  };

  if (isServer) {
    return getServerSnapshot;
  }

  const [hydrated, setHydrated] = createSignal(!isHydrating());
  if (isHydrating()) {
    onSettled(() => {
      setHydrated(true);
    });
  }

  const mediaQueryList = createMemo(() => {
    const match = matchMedia();
    return match ? match(resolvedQuery()) : null;
  });

  // `MediaQueryList.matches` is not reactive: bump a version on each `change` event.
  const [version, setVersion] = createSignal(0);

  createEffect(mediaQueryList, (list) => {
    if (!list) {
      return undefined;
    }
    // Catch a change that happened between the first read and the subscription.
    setVersion((value) => value + 1);
    return addEventListener(list, 'change', () => {
      setVersion((value) => value + 1);
    });
  });

  return createMemo(() => {
    version();
    if (!hydrated()) {
      return getServerSnapshot();
    }
    const list = mediaQueryList();
    return list ? list.matches : defaultMatches();
  });
}

export interface UseMediaQueryOptions {
  /**
   * As `window.matchMedia()` is unavailable on the server,
   * it returns a default matches during the first mount.
   * @default false
   */
  defaultMatches?: boolean | undefined;
  /**
   * You can provide your own implementation of matchMedia.
   * This can be used for handling an iframe content window.
   * Pass `null` to disable media query matching.
   */
  matchMedia?: typeof window.matchMedia | null | undefined;
  /**
   * To perform the server-side hydration, the primitive needs to render twice.
   * A first time with `defaultMatches`, the value of the server, and a second time with the resolved value.
   * You can set this option to `true` if you use the returned value **only** client-side.
   * @default false
   */
  noSsr?: boolean | undefined;
  /**
   * You can provide your own implementation of `matchMedia`, it's used when rendering server-side.
   */
  ssrMatchMedia?: ((query: string) => { matches: boolean }) | undefined;
}

export interface UseMediaQueryState {}

export namespace useMediaQuery {
  export type State = UseMediaQueryState;
  export type Options = UseMediaQueryOptions;
}
