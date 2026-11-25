import { createEffect, onCleanup, type Accessor } from 'solid-js';
import { NOOP } from '../noop';
import { createBaseUiId } from '../baseUiId';
import { useLabelableContext } from './LabelableContext';

export interface CreateLabelableIdParameters {
  /**
   * The control's `id`. Return `null` for a control that takes its name from `aria-labelledby`
   * instead, so that the label omits `for`.
   */
  id?: Accessor<string | null | undefined> | undefined;
  /**
   * Whether the control owns the label association of its labelable scope.
   * @default () => true
   */
  enabled?: Accessor<boolean | undefined> | undefined;
}

/**
 * Registers a control in the closest labelable scope (`<Field.Root>`, `<Field.Item>`, …) and
 * returns the `id` to render on it. The label of the scope points its `for` at this id.
 */
export function createLabelableId(params: CreateLabelableIdParameters = {}): Accessor<string> {
  const { controlId, registerControlId, resetControlId } = useLabelableContext();
  const hasProvider = registerControlId !== NOOP;

  const defaultId = createBaseUiId();
  const source = Symbol('labelable-control');
  let hasRegistered = false;
  let hadExplicitId = false;

  const enabled = () => params.enabled?.() ?? true;

  function unregisterControlId() {
    if (!hasRegistered || !hasProvider) {
      return;
    }
    hasRegistered = false;
    registerControlId(source, undefined);
  }

  createEffect(
    () => [enabled(), params.id?.()] as const,
    ([isEnabled, id]) => {
      if (!isEnabled || !hasProvider) {
        unregisterControlId();
        return;
      }

      let nextId: string | null;

      if (id !== undefined) {
        hadExplicitId = true;
        nextId = id;
      } else if (hadExplicitId) {
        nextId = defaultId();
      } else {
        // An id-less replacement must claim the provider's fallback so a previously registered
        // explicit id is not retained after its control unmounts.
        resetControlId();
        return;
      }

      hasRegistered = true;
      registerControlId(source, nextId);
    },
  );

  onCleanup(unregisterControlId);

  // The provider's id wins until registration runs, so the label and the control always agree.
  return () => (enabled() ? controlId() : undefined) ?? params.id?.() ?? defaultId();
}
