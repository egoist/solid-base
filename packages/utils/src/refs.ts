export type RefCallback<T> = (element: T) => void;
export type RefProp<T> = RefCallback<T> | RefProp<T>[] | undefined | null | false;

/**
 * Invokes a ref (a callback or a nested array of callbacks) with the given element.
 */
export function applyRef<T>(ref: RefProp<T>, element: T) {
  if (typeof ref === 'function') {
    ref(element);
  } else if (Array.isArray(ref)) {
    for (let i = 0; i < ref.length; i += 1) {
      applyRef(ref[i], element);
    }
  }
}

/**
 * Combines several refs into a single ref callback.
 */
export function mergeRefs<T>(...refs: RefProp<T>[]): RefCallback<T> {
  return (element: T) => {
    for (let i = 0; i < refs.length; i += 1) {
      applyRef(refs[i], element);
    }
  };
}
