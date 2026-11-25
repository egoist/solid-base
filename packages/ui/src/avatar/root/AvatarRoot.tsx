import { createSignal, omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { AvatarRootContext } from './AvatarRootContext';
import { avatarStateAttributesMapping } from './stateAttributesMapping';

/**
 * Displays a user's profile picture, initials, or fallback icon.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Avatar](https://base-ui.com/react/components/avatar)
 */
export function AvatarRoot(componentProps: AvatarRoot.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const [imageLoadingStatus, setImageLoadingStatus] = createSignal<ImageLoadingStatus>('idle');

  const state: AvatarRootState = {
    get imageLoadingStatus() {
      return imageLoadingStatus();
    },
  };

  const contextValue: AvatarRootContext = {
    imageLoadingStatus,
    setImageLoadingStatus(status) {
      setImageLoadingStatus(status);
    },
  };

  return (
    <AvatarRootContext value={contextValue}>
      {renderElement('span', componentProps, {
        state,
        props: elementProps,
        stateAttributesMapping: avatarStateAttributesMapping,
      })}
    </AvatarRootContext>
  );
}

export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface AvatarRootState {
  /**
   * The image loading status.
   */
  imageLoadingStatus: ImageLoadingStatus;
}

export interface AvatarRootProps extends BaseUIComponentProps<'span', AvatarRootState> {}

export namespace AvatarRoot {
  export type State = AvatarRootState;
  export type Props = AvatarRootProps;
}
