import type { JSX } from '@solidjs/web';

export type {
  BaseUIChangeEventDetails,
  BaseUIGenericEventDetails,
} from '../internals/createBaseUIEventDetails';

/**
 * Props spread on a rendered element. Intentionally loose: Base UI builds them from several
 * live sources, and `aria-*` booleans are serialized to `"true"`/`"false"` when merged.
 */
export type HTMLProps<T = any> = {
  [key: string]: any;
  ref?: JSX.Ref<T> | undefined;
  children?: JSX.Element | undefined;
};

/**
 * Shape of the render prop: a function that takes props to be spread on the element and the
 * component's (reactive) state, and returns the element to render.
 *
 * It is called once. Both `props` and `state` are live objects: read them inside JSX or other
 * tracking scopes to stay reactive, and spread `props` (`<a {...props} />`) rather than
 * destructuring them.
 *
 * @template Props Props to be spread on the rendered element.
 * @template State Component's internal state.
 */
export type ComponentRenderFn<Props, State> = (props: Props, state: State) => JSX.Element;

/**
 * An event that passed through a Base UI handler chain.
 */
export type BaseUIEvent<E extends Event> = E & {
  /**
   * Prevents the Base UI handlers that run after this one (the component's internal logic).
   */
  preventBaseUIHandler: () => void;
  readonly baseUIHandlerPrevented?: boolean | undefined;
};
