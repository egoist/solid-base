import { createEffect, onCleanup, type Accessor } from 'solid-js';
import { useFieldRootContext } from '../field-root-context/FieldRootContext';
import type { FieldControlRegistration } from './createFieldControlRegistration';

export interface CreateRegisterFieldControlParameters {
  /**
   * The element focused when the form is submitted with this field invalid.
   */
  controlRef: FieldControlRegistration['controlRef'];
  /**
   * The key of the field in the form registry. Usually a generated id, or the control id.
   */
  id: Accessor<string | undefined>;
  /**
   * The control's current value (reactive). Return `undefined` to read it through `getValue`.
   */
  value: Accessor<unknown>;
  /**
   * Reads the value submitted through `onFormSubmit` when `value` returns `undefined`.
   */
  getValue?: FieldControlRegistration['getValue'];
  /**
   * Whether the control participates in the field (usually `!disabled`).
   * @default () => true
   */
  enabled?: Accessor<boolean | undefined> | undefined;
  /**
   * The control's own `name`, used when `<Field.Root>` has none.
   */
  name?: Accessor<string | undefined> | undefined;
}

/**
 * Registers a control in the closest `<Field.Root>` (no-op outside of a field), so that the
 * field captures its initial value (for `dirty`), and the enclosing form can validate it, focus
 * it when invalid, and read its value on submit.
 */
export function createRegisterFieldControl(params: CreateRegisterFieldControlParameters) {
  const { registerFieldControl } = useFieldRootContext();
  const source = Symbol('field-control');

  // Re-register without unregistering first: re-registration with the same id updates the
  // form's fields Map entry in place, while a delete + re-add would move the field to the
  // end of the Map every time its value changes.
  createEffect(
    () =>
      [params.enabled?.() ?? true, params.id(), params.value(), params.name?.()] as const,
    ([enabled, id, value, name]) => {
      if (!enabled) {
        registerFieldControl(source, undefined);
        return;
      }

      registerFieldControl(source, {
        controlRef: params.controlRef,
        getValue: params.getValue,
        id,
        name,
        value,
      });
    },
  );

  onCleanup(() => {
    registerFieldControl(source, undefined);
  });
}
