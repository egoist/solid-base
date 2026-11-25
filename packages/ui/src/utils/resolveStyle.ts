import type { JSX } from '@solidjs/web';

export type StyleProp<State> =
  | JSX.CSSProperties
  | string
  | ((state: State) => JSX.CSSProperties | string | undefined)
  | undefined;

/**
 * If the provided style is a function, calls it with the state. Returns it as is otherwise.
 */
export function resolveStyle<State>(style: StyleProp<State>, state: State) {
  return typeof style === 'function' ? style(state) : style;
}
