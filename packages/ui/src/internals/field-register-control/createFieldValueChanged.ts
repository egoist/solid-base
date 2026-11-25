import { createEffect, untrack, type Accessor } from 'solid-js';

/**
 * Runs `onValueChanged` after the control's committed value changed (upstream's
 * `useValueChanged`), to clear the field's external error and run change validation.
 *
 * Validation measures the rendered control: the native constraint validity of its input (which
 * only reflects the new value once it rendered) and the `validate` callback. It is not derivable,
 * so the validity lands one flush after the value: the cost of measuring. The value is read when
 * the measurement runs, like the DOM state it is validated with, rather than relayed from the
 * effect's compute.
 */
export function createFieldValueChanged<T>(
  value: Accessor<T>,
  onValueChanged: (value: T) => void,
) {
  createEffect(
    value,
    () => {
      // Imperative reaction: reads the field state at call time.
      untrack(() => onValueChanged(value()));
    },
    { defer: true, name: 'createFieldValueChanged' },
  );
}
