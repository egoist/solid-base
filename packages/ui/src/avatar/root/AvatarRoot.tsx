import { createSignal, omit, type Accessor } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { AvatarRootContext } from './AvatarRootContext';
import { avatarStateAttributesMapping } from './stateAttributesMapping';

/**
 * Displays a user's profile picture, initials, or fallback icon.
 * Renders a `<span>` element.
 *
 * Documentation: [Solid Base Avatar](https://base.egoist.dev/components/avatar)
 */
export function AvatarRoot(componentProps: AvatarRoot.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  // The status of the mounted image (`idle` without one), read from the image itself.
  const [imageStatusSource, setImageStatusSource] = createSignal<
    Accessor<ImageLoadingStatus> | undefined
  >(undefined);
  const imageLoadingStatus = (): ImageLoadingStatus => imageStatusSource()?.() ?? 'idle';

  const state: AvatarRootState = {
    get imageLoadingStatus() {
      return imageLoadingStatus();
    },
  };

  const contextValue: AvatarRootContext = {
    imageLoadingStatus,
    registerImageLoadingStatus(status) {
      setImageStatusSource(() => status);
      return () => {
        setImageStatusSource((current) => (current === status ? undefined : current));
      };
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
