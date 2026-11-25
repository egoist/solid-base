import { createEffect, createSignal, type Accessor } from 'solid-js';
import type { ImageLoadingStatus } from '../root/AvatarRoot';

export interface CreateImageLoadingStatusOptions {
  src: Accessor<string | undefined>;
  referrerPolicy: Accessor<string | undefined>;
  /** `true` is the boolean form of `crossorigin=""` (anonymous). */
  crossOrigin: Accessor<string | true | null | undefined>;
  sizes: Accessor<string | undefined>;
  srcSet: Accessor<string | undefined>;
  enabled: Accessor<boolean>;
}

/**
 * Preloads the image with a detached `Image` and reports its loading status.
 */
export function createImageLoadingStatus(options: CreateImageLoadingStatusOptions) {
  const [status, setStatus] = createSignal<ImageLoadingStatus>('idle');

  createEffect(
    () => ({
      enabled: options.enabled(),
      src: options.src(),
      srcSet: options.srcSet(),
      sizes: options.sizes(),
      crossOrigin: options.crossOrigin(),
      referrerPolicy: options.referrerPolicy(),
    }),
    ({ enabled, src, srcSet, sizes, crossOrigin, referrerPolicy }) => {
      if (!enabled) {
        return undefined;
      }

      if (!src && !srcSet) {
        setStatus('error');
        return undefined;
      }

      let isMounted = true;
      const image = new window.Image();

      const updateStatus = (next: ImageLoadingStatus) => () => {
        if (isMounted) {
          setStatus(next);
        }
      };

      let nextStatus: ImageLoadingStatus = 'loading';
      image.onload = updateStatus('loaded');
      image.onerror = updateStatus('error');
      if (referrerPolicy) {
        image.referrerPolicy = referrerPolicy as ReferrerPolicy;
      }
      image.crossOrigin = crossOrigin === true ? '' : (crossOrigin ?? null);
      if (sizes) {
        image.sizes = sizes;
      }
      if (srcSet) {
        image.srcset = srcSet;
      }
      if (src) {
        image.src = src;
      }

      // Fast path for cached/decoded images
      if (image.complete) {
        nextStatus = image.naturalWidth > 0 ? 'loaded' : 'error';
      }
      setStatus(nextStatus);

      return () => {
        isMounted = false;
      };
    },
  );

  return [status, setStatus] as const;
}
