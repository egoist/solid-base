import { onCleanup } from 'solid-js';
import type { HTMLProps } from '../../../../internals/types';
import { FOCUSABLE_ATTRIBUTE } from '../../constants';
import { getInteractionProps } from '../../testUtils';
import type { ElementProps } from '../../types';

/**
 * Returns a ref callback that registers an element and unregisters it (`set(null)`) when the
 * owner calling `cleanupRef` is disposed: Solid doesn't call ref callbacks with `null` on
 * unmount, unlike React. Call it in the component body or JSX of the element's owner.
 */
export function cleanupRef<T extends Element>(set: (element: T | null) => void) {
  let current: T | null = null;
  onCleanup(() => {
    if (current) {
      current = null;
      set(null);
    }
  });
  return (element: T) => {
    current = element;
    set(element);
  };
}

/**
 * `getInteractionProps(list, 'floating', userProps)` plus what upstream's `useTestInteractions`
 * adds to every floating element: `tabindex="-1"` and the focusable marker attribute.
 */
export function getFloatingTestProps(
  list: Array<ElementProps | undefined>,
  userProps?: HTMLProps,
): HTMLProps {
  return getInteractionProps(list, 'floating', {
    tabindex: -1,
    [FOCUSABLE_ATTRIBUTE]: '',
    ...userProps,
  });
}
