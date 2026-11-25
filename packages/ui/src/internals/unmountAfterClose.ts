import { createEffect, flush, untrack, type Accessor } from 'solid-js';
import { createTransitionStatus, type TransitionStatus } from './transitionStatus';
import { createOpenChangeComplete } from './openChangeComplete';

export interface CreateUnmountAfterCloseParameters {
  /**
   * Whether the popup is open.
   */
  open: Accessor<boolean>;
  /**
   * The element whose closing animations are awaited before unmounting. A popup that closes
   * before its element attaches waits for it, then for its closing animations.
   */
  element: Accessor<HTMLElement | null | undefined>;
  /**
   * Whether the current close cycle asked to keep the popup mounted until the `unmount` action
   * is called. Ignored while `open`.
   */
  preventUnmountOnClose: Accessor<boolean>;
  /**
   * Writes `preventUnmountOnClose`. Opening starts a new close cycle, so it is cleared whenever
   * `open` becomes `true`.
   */
  setPreventUnmountOnClose: (preventUnmountOnClose: boolean) => void;
  /**
   * Runs once per unmount, whether it completed automatically or through `forceUnmount`.
   */
  onUnmount: () => void;
  /**
   * Whether a popup that mounts already open should still play its enter transition.
   * See `createTransitionStatus`.
   */
  animateInitialOpen?: boolean | undefined;
}

export interface CreateUnmountAfterCloseReturnValue {
  mounted: Accessor<boolean>;
  transitionStatus: Accessor<TransitionStatus>;
  preventUnmountingOnClose: Accessor<boolean>;
  /**
   * Unmounts the popup immediately. A no-op once the popup is already unmounted, and while it is
   * still open after pending updates are flushed.
   */
  forceUnmount: () => void;
}

/**
 * Keeps a popup mounted through its closing animation and unmounts it once the animation
 * finishes, unless the close cycle opted out through `preventUnmountOnClose`.
 * Store-agnostic: hosts bind `mounted` and `transitionStatus` wherever they need them.
 */
export function createUnmountAfterClose(
  parameters: CreateUnmountAfterCloseParameters,
): CreateUnmountAfterCloseReturnValue {
  const { open, element, setPreventUnmountOnClose, onUnmount, animateInitialOpen } = parameters;

  const { mounted, setMounted, transitionStatus } = createTransitionStatus(open, {
    animateInitialOpen,
  });

  // Opening starts a new close cycle.
  const preventUnmountingOnClose = () => (open() ? false : parameters.preventUnmountOnClose());

  // `mounted` lags `setMounted(false)` until the next flush: remember the unmount so a second
  // `unmount()` in the same batch doesn't complete closing twice.
  let unmountPending = false;

  createEffect(open, (isOpen) => {
    // An open change (a reopen, or the close that follows it) starts a new cycle.
    unmountPending = false;
    // Opening starts a new close cycle.
    if (isOpen) {
      setPreventUnmountOnClose(false);
    }
  });

  function unmount() {
    unmountPending = true;
    setMounted(false);
    onUnmount();
  }

  function forceUnmount() {
    if (!untrack(mounted) || unmountPending) {
      return;
    }
    if (untrack(open)) {
      // A close may have been requested in the same batch (`close(); unmount()`), but a controlled
      // `open` prop only lands on the next flush. Decide once pending updates are applied.
      flush();
      if (untrack(open) || !untrack(mounted)) {
        return;
      }
    }
    unmount();
  }

  // Every close starts the wait; `forceUnmount` ignores a completion once the popup is unmounted.
  // `mounted` isn't an input: the wait's own completion unmounts the popup, which must not restart
  // it.
  createOpenChangeComplete({
    enabled: () => !open() && !preventUnmountingOnClose(),
    open,
    element,
    onComplete() {
      if (!untrack(open)) {
        forceUnmount();
      }
    },
  });

  return { mounted, transitionStatus, preventUnmountingOnClose, forceUnmount };
}
