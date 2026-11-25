import { flush, type Accessor } from 'solid-js';
import { createAnimationFrame } from '@egoist/solid-base-utils/animationFrame';
import { NOOP } from '@egoist/solid-base-utils/empty';
import { isFiniteAnimation } from '../utils/getFiniteAnimations';
import * as TransitionStatusDataAttributes from './TransitionStatusDataAttributes';

declare global {
  // eslint-disable-next-line vars-on-top, no-var
  var BASE_UI_ANIMATIONS_DISABLED: boolean | undefined;
}

/**
 * Returns a function that runs a callback once all animations of `element` have finished.
 * If an animation is canceled, waits for any replacement animations before executing.
 *
 * @param element - The element to watch for animations.
 * @param waitForStartingStyleRemoved - Whether to wait for `[data-starting-style]` to be removed
 *   before checking for animations.
 */
export function createAnimationsFinished(
  element: Accessor<HTMLElement | null | undefined>,
  waitForStartingStyleRemoved: Accessor<boolean> | boolean = false,
) {
  const frame = createAnimationFrame();

  return (fnToExecute: () => void, signal: AbortSignal | null = null) => {
    frame.cancel();

    const resolvedElement = element();
    if (resolvedElement == null) {
      return;
    }

    const done = () => {
      fnToExecute();
      // Apply the resulting updates (usually unmounting) before the browser paints.
      flush();
    };

    if (
      typeof resolvedElement.getAnimations !== 'function' ||
      globalThis.BASE_UI_ANIMATIONS_DISABLED
    ) {
      fnToExecute();
      return;
    }

    function exec() {
      const animations = resolvedElement!.getAnimations();
      Promise.all(
        animations.filter(isFiniteAnimation).map((animation) => animation.finished.then(NOOP)),
      ).then(
        () => {
          if (!signal?.aborted) {
            done();
          }
        },
        () => {
          // Animations can be aborted because a property they depend on changes while they play.
          // Wait for the element's current animations, which include any replacement.
          if (!signal?.aborted) {
            exec();
          }
        },
      );
    }

    const waitForStartingStyle =
      typeof waitForStartingStyleRemoved === 'function'
        ? waitForStartingStyleRemoved()
        : waitForStartingStyleRemoved;

    if (waitForStartingStyle) {
      const startingStyleAttribute = TransitionStatusDataAttributes.startingStyle;

      // If `[data-starting-style]` isn't present, fall back to waiting one more frame
      // to give "open" animations a chance to be registered.
      if (!resolvedElement.hasAttribute(startingStyleAttribute)) {
        frame.request(exec);
        return;
      }

      // Wait for `[data-starting-style]` to have been removed.
      const attributeObserver = new MutationObserver(() => {
        if (!resolvedElement.hasAttribute(startingStyleAttribute)) {
          attributeObserver.disconnect();
          exec();
        }
      });

      attributeObserver.observe(resolvedElement, {
        attributes: true,
        attributeFilter: [startingStyleAttribute],
      });

      signal?.addEventListener('abort', () => attributeObserver.disconnect(), { once: true });
      return;
    }

    frame.request(exec);
  };
}
