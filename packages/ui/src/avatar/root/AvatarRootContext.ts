import { createContext, useContext, type Accessor } from 'solid-js';
import type { ImageLoadingStatus } from './AvatarRoot';

export interface AvatarRootContext {
  imageLoadingStatus: Accessor<ImageLoadingStatus>;
  /**
   * Publishes the status of the mounted image. Returns the unregister function.
   */
  registerImageLoadingStatus: (status: Accessor<ImageLoadingStatus>) => () => void;
}

export const AvatarRootContext = createContext<AvatarRootContext | null>(null);

export function useAvatarRootContext() {
  const context = useContext(AvatarRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: AvatarRootContext is missing. Avatar parts must be placed within <Avatar.Root>.',
    );
  }
  return context;
}
