import { createEffect, type Accessor } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';

/**
 * A ref to imperative actions: a `{ current }` object, or a callback receiving the actions
 * (and `null` on unmount).
 */
export type ActionsRef<Actions> =
  | RefObject<Actions | null>
  | ((actions: Actions | null) => void);

/**
 * Publishes `actions` to the `actionsRef` returned by `ref` while mounted
 * (upstream's `useImperativeHandle(actionsRef, ...)`).
 */
export function createActionsRef<Actions>(
  ref: Accessor<ActionsRef<Actions> | null | undefined>,
  actions: Actions,
) {
  createEffect(ref, (current) => {
    if (!current) {
      return undefined;
    }
    assign(current, actions);
    return () => assign(current, null);
  });
}

function assign<Actions>(ref: ActionsRef<Actions>, value: Actions | null) {
  if (typeof ref === 'function') {
    ref(value);
  } else {
    ref.current = value;
  }
}
