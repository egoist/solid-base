import type { JSX } from '@solidjs/web';
import type { ClassProp } from '../internals/types';

/**
 * If the provided class is a function, calls it with the state. Returns it as is otherwise.
 */
export function resolveClassName<State>(
  className: ClassProp<State> | undefined,
  state: State,
): JSX.ClassValue {
  return typeof className === 'function' ? className(state) : className;
}
