import { createEffect, createMemo, createSignal, untrack, type Accessor } from 'solid-js';
import { AnimationFrame } from '@egoist/solid-base-utils/animationFrame';

export type TransitionStatus = 'starting' | 'ending' | 'idle' | undefined;

export interface CreateTransitionStatusOptions {
  /** Enables the `'idle'` state between `'starting'` and `'ending'`. */
  enableIdleState?: boolean | undefined;
  /** Delays the `'ending'` state by a frame. */
  deferEndingState?: boolean | undefined;
  /**
   * Makes an element which mounts already open still go through `'starting'`. Off by default so
   * content that was open on the first render (a `defaultOpen` popup on page load) doesn't
   * animate in.
   */
  animateInitialOpen?: boolean | undefined;
}

export interface CreateTransitionStatusReturnValue {
  /** Whether the element should be in the DOM (open, or closing with an exit animation). */
  mounted: Accessor<boolean>;
  /** Unmounts the element once its exit animation finished. */
  setMounted: (mounted: boolean) => void;
  transitionStatus: Accessor<TransitionStatus>;
}

/**
 * Provides a status string for CSS animations.
 * @param open - whether the element is open.
 */
export function createTransitionStatus(
  open: Accessor<boolean>,
  options: CreateTransitionStatusOptions = {},
): CreateTransitionStatusReturnValue {
  const { enableIdleState = false, deferEndingState = false, animateInitialOpen = false } = options;

  const initiallyOpen = untrack(open);
  let previousOpen = initiallyOpen && !animateInitialOpen;

  // The last `setMounted` call. A fresh object per call, so the same request isn't applied twice.
  const [mountRequest, setMountRequest] = createSignal<{ mounted: boolean } | null>(null, {
    ownedWrite: true,
  });
  let appliedMountRequest: { mounted: boolean } | null = null;

  // While open, the element is mounted. Once closed, it stays mounted until `setMounted(false)`.
  // Derived (rather than set by an effect when `open` changes), so it follows `open` in the same
  // flush.
  const mountedAfterClose = createMemo<boolean>(
    (wasMounted) => {
      const isOpen = open();
      const request = mountRequest();
      const pendingRequest = request !== appliedMountRequest ? request : null;
      appliedMountRequest = request;
      if (isOpen) {
        return true;
      }
      return pendingRequest ? pendingRequest.mounted : (wasMounted ?? false);
    },
    { name: 'createTransitionStatus.mounted' },
  );
  const mounted = () => open() || mountedAfterClose();

  // Derived from `open` synchronously, so the element mounts with `[data-starting-style]`
  // already applied. Frame callbacks overwrite it locally until `open` changes again.
  const [transitionStatus, setTransitionStatus] = createSignal<TransitionStatus>(
    (previous) => {
      const isOpen = open();
      const wasOpen = previousOpen;
      previousOpen = isOpen;
      if (isOpen) {
        return wasOpen ? (previous ?? (enableIdleState ? 'idle' : undefined)) : 'starting';
      }
      if (untrack(mounted) || wasOpen) {
        return deferEndingState ? previous : 'ending';
      }
      return undefined;
    },
  );

  createEffect(
    () => [open(), transitionStatus()] as const,
    ([isOpen, status]) => {
      if (isOpen && status === 'starting') {
        const frame = AnimationFrame.request(() => {
          setTransitionStatus(enableIdleState ? 'idle' : undefined);
        });
        return () => AnimationFrame.cancel(frame);
      }
      if (!isOpen && deferEndingState && status !== 'ending' && untrack(mounted)) {
        const frame = AnimationFrame.request(() => {
          setTransitionStatus('ending');
        });
        return () => AnimationFrame.cancel(frame);
      }
      return undefined;
    },
  );

  function setMounted(next: boolean) {
    setMountRequest({ mounted: next });
    if (!next && !untrack(open)) {
      setTransitionStatus(undefined);
    }
  }

  return { mounted, setMounted, transitionStatus };
}
