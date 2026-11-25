import { createMemo, type Accessor } from 'solid-js';

/**
 * Tracks the value `source` held before its latest change.
 */
export function createPreviousValue<T>(source: Accessor<T>): Accessor<T | null> {
  let current: T | undefined;
  let hasCurrent = false;
  const previous = createMemo<T | null>((prev) => {
    const next = source();
    if (!hasCurrent) {
      hasCurrent = true;
      current = next;
      return null;
    }
    if (Object.is(next, current)) {
      return prev ?? null;
    }
    const before = current as T;
    current = next;
    return before;
  });
  return previous;
}
