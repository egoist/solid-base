import { createEffect, type Accessor } from 'solid-js';
import { createAnimationsFinished } from './animationsFinished';

export interface CreateOpenChangeCompleteParameters {
  /**
   * Whether the primitive is enabled.
   * @default () => true
   */
  enabled?: Accessor<boolean> | undefined;
  /**
   * Whether the element is open.
   */
  open: Accessor<boolean>;
  /**
   * The element being opened or closed.
   */
  element: Accessor<HTMLElement | null | undefined>;
  /**
   * Called when the CSS open/close animation or transition completes (or there is none).
   */
  onComplete: () => void;
}

/**
 * Calls `onComplete` when the open/close animation of an element completes.
 * Restarts whenever `open` or `enabled` change.
 */
export function createOpenChangeComplete(parameters: CreateOpenChangeCompleteParameters) {
  const runOnceAnimationsFinish = createAnimationsFinished(parameters.element, parameters.open);

  // Like upstream, the element is read when the wait starts, not tracked: tracking it would make
  // the effect re-run when `onComplete` unmounts the element (a write feeding its own input).
  createEffect(
    () => [parameters.enabled?.() ?? true, parameters.open()] as const,
    ([enabled]) => {
      if (!enabled) {
        return undefined;
      }
      const abortController = new AbortController();
      runOnceAnimationsFinish(parameters.onComplete, abortController.signal);
      return () => abortController.abort();
    },
  );
}
