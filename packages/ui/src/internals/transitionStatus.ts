import { createEffect, createSignal, untrack, type Accessor } from 'solid-js';
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
  const [mountedState, setMountedState] = createSignal(initiallyOpen && !animateInitialOpen);
  let previousOpen = initiallyOpen && !animateInitialOpen;

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
      if (untrack(mountedState) || wasOpen) {
        return deferEndingState ? previous : 'ending';
      }
      return undefined;
    },
  );

  // While open, the element is mounted. Once closed, it stays mounted until `setMounted(false)`.
  const mounted = () => open() || mountedState();

  createEffect(open, (isOpen) => {
    if (isOpen) {
      setMountedState(true);
    }
  });

  createEffect(
    () => [open(), transitionStatus()] as const,
    ([isOpen, status]) => {
      if (isOpen && status === 'starting') {
        const frame = AnimationFrame.request(() => {
          setTransitionStatus(enableIdleState ? 'idle' : undefined);
        });
        return () => AnimationFrame.cancel(frame);
      }
      if (!isOpen && deferEndingState && status !== 'ending' && untrack(mountedState)) {
        const frame = AnimationFrame.request(() => {
          setTransitionStatus('ending');
        });
        return () => AnimationFrame.cancel(frame);
      }
      return undefined;
    },
  );

  function setMounted(next: boolean) {
    setMountedState(next);
    if (!next && !untrack(open)) {
      setTransitionStatus(undefined);
    }
  }

  return { mounted, setMounted, transitionStatus };
}
