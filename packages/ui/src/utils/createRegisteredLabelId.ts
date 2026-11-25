import { createEffect, createMemo, type Accessor } from 'solid-js';
import { createBaseUiId } from '../internals/baseUiId';

type LabelIdSetter = (updater: (prev: string | undefined) => string | undefined) => void;

/**
 * Generates the id of a label-like element (unless `idProp` returns one) and publishes it with
 * `setLabelId` while mounted. On unmount (or when the id changes), the published id is only
 * cleared if no other label replaced it in the meantime.
 */
export function createRegisteredLabelId(
  idProp: Accessor<string | undefined>,
  setLabelId: LabelIdSetter,
): Accessor<string> {
  const id = createMemo(createBaseUiId(idProp));

  createEffect(id, (current) => {
    setLabelId(() => current);
    return () => {
      setLabelId((previous) => (previous === current ? undefined : previous));
    };
  });

  return id;
}
