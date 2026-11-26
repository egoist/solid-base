import { createEffect, createSignal, omit } from 'solid-js';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { useAvatarRootContext } from '../root/AvatarRootContext';
import type { AvatarRootState } from '../root/AvatarRoot';
import { avatarStateAttributesMapping } from '../root/stateAttributesMapping';

/**
 * Rendered when the image fails to load or when no image is provided.
 * Renders a `<span>` element.
 *
 * Documentation: [Solid Base Avatar](https://base.egoist.dev/components/avatar)
 */
export function AvatarFallback(componentProps: AvatarFallback.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'delay');

  const delay = () => componentProps.delay ?? 0;

  const { imageLoadingStatus } = useAvatarRootContext();
  const [delayPassed, setDelayPassed] = createSignal(false);
  const timeout = createTimeout();

  createEffect(delay, (value) => {
    if (value > 0) {
      timeout.start(value, () => setDelayPassed(true));
    } else {
      // Once the fallback is shown without a delay, keep it visible. Otherwise a later
      // change from no delay to a number would re-hide an already-visible fallback.
      setDelayPassed(true);
    }
    return timeout.clear;
  });

  const state: AvatarFallbackState = {
    get imageLoadingStatus() {
      return imageLoadingStatus();
    },
  };

  return renderElement('span', componentProps, {
    state,
    props: elementProps,
    stateAttributesMapping: avatarStateAttributesMapping,
    enabled: () => imageLoadingStatus() !== 'loaded' && (delay() === 0 || delayPassed()),
  });
}

export interface AvatarFallbackState extends AvatarRootState {}

export interface AvatarFallbackProps extends BaseUIComponentProps<'span', AvatarFallbackState> {
  /**
   * How long to wait before showing the fallback. Specified in milliseconds.
   *
   * @default 0
   */
  delay?: number | undefined;
}

export namespace AvatarFallback {
  export type State = AvatarFallbackState;
  export type Props = AvatarFallbackProps;
}
