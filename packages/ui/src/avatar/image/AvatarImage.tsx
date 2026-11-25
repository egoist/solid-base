import { createEffect, createSignal, merge, omit, onSettled } from 'solid-js';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { renderElement } from '../../internals/renderElement';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import {
  createTransitionStatus,
  type TransitionStatus,
} from '../../internals/transitionStatus';
import { useAvatarRootContext } from '../root/AvatarRootContext';
import type { AvatarRootState, ImageLoadingStatus } from '../root/AvatarRoot';
import { avatarStateAttributesMapping } from '../root/stateAttributesMapping';
import { createImageLoadingStatus } from './createImageLoadingStatus';

const stateAttributesMapping: StateAttributesMapping<AvatarImageState> = {
  ...avatarStateAttributesMapping,
  ...transitionStatusMapping,
};

// Attributes that change which image the rendered element loads.
const SOURCE_ATTRIBUTES = ['src', 'srcset', 'sizes', 'crossorigin', 'referrerpolicy'];

/** Solid removes an attribute set to `false`. */
function attributeValue<T>(value: T | false | undefined): T | undefined {
  return value === false ? undefined : value;
}

/**
 * The image to be displayed in the avatar.
 * Renders an `<img>` element.
 *
 * Documentation: [Base UI Avatar](https://base-ui.com/react/components/avatar)
 */
export function AvatarImage(componentProps: AvatarImage.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'onLoadingStatusChange',
    'keepMounted',
    // Applied after every other prop: browsers start fetching as soon as `src` lands, ignoring a
    // `loading` or `srcset` that arrives after it.
    'sizes',
    'srcset',
    'src',
  );

  const keepMounted = () => componentProps.keepMounted ?? false;

  const rootContext = useAvatarRootContext();
  const [imageLoadingStatus, setImageLoadingStatus] = createImageLoadingStatus({
    src: () => attributeValue(componentProps.src),
    srcSet: () => attributeValue(componentProps.srcset),
    sizes: () => attributeValue(componentProps.sizes),
    crossOrigin: () => attributeValue(componentProps.crossorigin),
    referrerPolicy: () => attributeValue(componentProps.referrerpolicy),
    enabled: () => !keepMounted(),
  });

  const isVisible = () => imageLoadingStatus() === 'loaded';
  const { mounted, transitionStatus, setMounted } = createTransitionStatus(isVisible);

  const [imageElement, setImageElement] = createSignal<HTMLImageElement | null>(null);
  let lastImageElement: HTMLImageElement | null = null;
  function handleImageRef(element: HTMLImageElement) {
    lastImageElement = element;
    setImageElement(element);
  }
  // An image that's already complete on the first commit was painted before hydration, so it
  // must not replay the enter animation.
  const [skipStartingStyle, setSkipStartingStyle] = createSignal(false);
  let isInitialCommit = true;

  // With `keepMounted`, the status comes from the rendered element itself, whose `load` event may
  // have already fired (cached images, or loads completed before hydration).
  function syncStatusFromElement(image: HTMLImageElement, initial: boolean) {
    if (!image.complete) {
      setSkipStartingStyle(false);
      setImageLoadingStatus('loading');
      return;
    }
    const status = image.naturalWidth > 0 ? 'loaded' : 'error';
    setSkipStartingStyle(status === 'loaded' && initial);
    setImageLoadingStatus(status);
  }

  createEffect(
    () => [
      keepMounted(),
      componentProps.src,
      componentProps.srcset,
      componentProps.sizes,
      componentProps.crossorigin,
      componentProps.referrerpolicy,
      imageElement(),
    ] as const,
    (deps) => {
      const keep = deps[0];
      const image = deps[6];
      if (!keep) {
        return;
      }
      const initial = isInitialCommit;
      isInitialCommit = false;
      if (!image) {
        // The `render` element didn't forward the ref. Its own `load`/`error` events remain the
        // only source of truth, so don't overwrite the status they already reported.
        return;
      }
      syncStatusFromElement(image, initial);
    },
  );

  // A `render` function can change the rendered element's source without going through props
  // (it is called once, and its own JSX stays reactive), so watch the element itself as well.
  createEffect(
    () => (keepMounted() ? imageElement() : null),
    (image) => {
      if (!image || typeof MutationObserver === 'undefined') {
        return undefined;
      }
      const observer = new MutationObserver(() => syncStatusFromElement(image, false));
      observer.observe(image, { attributes: true, attributeFilter: SOURCE_ATTRIBUTES });
      return () => observer.disconnect();
    },
  );

  createEffect(imageLoadingStatus, (status) => {
    if (status !== 'idle') {
      componentProps.onLoadingStatusChange?.(status);
    }
  });

  onSettled(() => rootContext.registerImageLoadingStatus(imageLoadingStatus));

  createOpenChangeComplete({
    enabled: () => !isVisible(),
    open: isVisible,
    // Read when the animations are inspected, not tracked: the image element is only replaced
    // while it is visible, and the primitive restarts whenever visibility changes.
    element: () => lastImageElement,
    onComplete() {
      // `mounted` stays `true` while the image is visible, so this only unmounts a hidden image.
      setMounted(false);
    },
  });

  const state: AvatarImageState = {
    get imageLoadingStatus() {
      return imageLoadingStatus();
    },
    get transitionStatus() {
      const status = transitionStatus();
      // The element never unmounts with `keepMounted`, so an exit transition would play and then
      // reverse itself once the status is cleared. `data-loading`/`data-error` cover that state.
      if (keepMounted() && status === 'ending') {
        return undefined;
      }
      if (status === 'starting' && skipStartingStyle()) {
        return undefined;
      }
      return status;
    },
  };

  const renderedStatusProps: HTMLProps = {
    // Presence no longer implies the image loaded, so the not-loaded states need their own
    // styling hooks. Scoped to `keepMounted` so the default mode, where the element only exists
    // once loaded, doesn't pick them up while it animates out.
    get 'data-loading'() {
      return keepMounted() && imageLoadingStatus() === 'loading' ? '' : undefined;
    },
    get 'data-error'() {
      return keepMounted() && imageLoadingStatus() === 'error' ? '' : undefined;
    },
    // Until the image is displayable, the fallback owns the accessible name; without this both
    // would be exposed to assistive technology at once.
    get 'aria-hidden'() {
      return keepMounted() && imageLoadingStatus() !== 'loaded' ? 'true' : undefined;
    },
    onLoad() {
      if (keepMounted()) {
        setSkipStartingStyle(false);
        setImageLoadingStatus('loaded');
      }
    },
    onError() {
      if (keepMounted()) {
        setSkipStartingStyle(false);
        setImageLoadingStatus('error');
      }
    },
  };

  // Only the defined source props are applied, so a `render` callback spreading the props after
  // its own source attributes keeps them.
  const sourceProps = merge(() => {
    const props: Record<string, string | false> = {};
    if (componentProps.sizes !== undefined) {
      props.sizes = componentProps.sizes;
    }
    if (componentProps.srcset !== undefined) {
      props.srcset = componentProps.srcset;
    }
    if (componentProps.src !== undefined) {
      props.src = componentProps.src;
    }
    return props;
  });

  return renderElement('img', componentProps, {
    state,
    ref: handleImageRef,
    props: [renderedStatusProps, elementProps, sourceProps],
    stateAttributesMapping,
    enabled: () => keepMounted() || mounted(),
  });
}

export interface AvatarImageState extends AvatarRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface AvatarImageProps extends BaseUIComponentProps<'img', AvatarImageState> {
  /**
   * Callback fired when the loading status changes.
   */
  onLoadingStatusChange?: ((status: ImageLoadingStatus) => void) | undefined;
  /**
   * Whether the image element stays mounted and loads in place instead of being preloaded.
   * Supports `loading="lazy"`.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace AvatarImage {
  export type State = AvatarImageState;
  export type Props = AvatarImageProps;
}
