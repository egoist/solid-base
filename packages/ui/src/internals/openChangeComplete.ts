import { createEffect, createMemo, untrack, type Accessor } from 'solid-js';
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

  const enabled = createMemo(() => parameters.enabled?.() ?? true, {
    name: 'createOpenChangeComplete.enabled',
  });

  // Like upstream, the element is read when the wait starts, not tracked: tracking it would make
  // the effect re-run when `onComplete` unmounts the element (a write feeding its own input).
  //
  // The wait measures the element (its running animations), and completes synchronously when
  // there are none: the apply half takes no argument, as what `onComplete` writes comes from that
  // measurement, not from the tracked values.
  createEffect(
    () => {
      if (enabled()) {
        parameters.open();
      }
    },
    () => {
      if (!untrack(enabled)) {
        return undefined;
      }
      const abortController = new AbortController();
      runOnceAnimationsFinish(parameters.onComplete, abortController.signal);
      return () => abortController.abort();
    },
    { name: 'createOpenChangeComplete.wait' },
  );
}
