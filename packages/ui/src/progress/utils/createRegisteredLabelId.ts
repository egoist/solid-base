import { createEffect, type Accessor } from 'solid-js';
import { createBaseUiId } from '../../internals/baseUiId';

/**
 * Generates the id of a label part and registers it on its root while mounted.
 *
 * Shared by Progress and Meter (upstream: `utils/useRegisteredLabelId`).
 */
export function createRegisteredLabelId(
  idProp: Accessor<string | undefined>,
  setLabelId: (updater: (currentId: string | undefined) => string | undefined) => void,
): Accessor<string> {
  const id = createBaseUiId(idProp);

  createEffect(id, (currentId) => {
    setLabelId(() => currentId);
    return () => {
      setLabelId((registeredId) => (registeredId === currentId ? undefined : registeredId));
    };
  });

  return id;
}
