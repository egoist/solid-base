import { createUniqueId, type Accessor } from 'solid-js';

/**
 * Generates a stable, SSR-safe id prefixed with `base-ui-`.
 * When `idOverride` returns a value, it takes precedence over the generated id.
 */
export function createBaseUiId(
  idOverride?: Accessor<string | undefined> | undefined,
): Accessor<string> {
  const generated = `base-ui-${createUniqueId()}`;
  if (!idOverride) {
    return () => generated;
  }
  return () => idOverride() ?? generated;
}
