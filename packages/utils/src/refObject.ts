/**
 * A mutable box holding a value, used for imperative state that must not trigger reactivity
 * (the equivalent of a plain variable shared across closures).
 */
export interface RefObject<T> {
  current: T;
}

export function createRefObject<T>(initial: T): RefObject<T> {
  return { current: initial };
}
