import { Show, merge, untrack } from 'solid-js';
import { dynamic, type JSX } from '@solidjs/web';
import type { RefProp } from '@egoist/solid-base-utils/refs';
import { EMPTY_OBJECT } from '@egoist/solid-base-utils/empty';
import { createRenderElementProps } from '../internals/renderElement';
import type { StateAttributesMapping } from '../internals/getStateAttributesProps';
import type {
  ComponentRenderFn,
  HTMLProps,
  IntrinsicTagName,
  RenderProp,
} from '../internals/types';
import type { PropsSource } from '../merge-props/mergeProps';

const BUTTON_DEFAULTS = { type: 'button' };
const IMG_DEFAULTS = { alt: '' };

/**
 * Renders a Base UI element.
 *
 * Returns the element to render: the `defaultTagName` element, or the element returned by the
 * `render` prop, with the given `props`, `ref`s and the `state` turned into `data-*` attributes.
 *
 * `render`, `defaultTagName`, `enabled` and `ref` are read lazily, so they can be getters
 * (`get render() { return props.render }`). `props` and `state` are read once: pass live objects
 * (`props: omit(props, 'render')`, a `state` object with getters) to keep them reactive.
 *
 * @public
 */
export function useRender<State extends Record<string, unknown> = Record<string, unknown>>(
  params: useRender.Parameters<State>,
): JSX.Element {
  const state = (params.state ?? EMPTY_OBJECT) as State;
  const tag = () => params.defaultTagName ?? 'div';

  const elementProps = createRenderElementProps<State>(
    undefined,
    {
      get render() {
        return params.render;
      },
    },
    {
      state: params.state,
      stateAttributesMapping: params.stateAttributesMapping,
      props: [
        // Native defaults of the default element (see `renderElement`). Only present when they
        // apply, so a `render` callback spreading the props keeps its own `type`.
        merge(() => {
          if (params.render != null) {
            return EMPTY_OBJECT;
          }
          const defaultTag = tag();
          if (defaultTag === 'button') {
            return BUTTON_DEFAULTS;
          }
          return defaultTag === 'img' ? IMG_DEFAULTS : EMPTY_OBJECT;
        }),
        {
          // Read when the element is created, so `ref` can be a getter.
          get ref() {
            return params.ref;
          },
        },
        params.props,
      ],
    },
  );

  const Element = dynamic(() => {
    const render = params.render;
    if (typeof render === 'function') {
      return (props: HTMLProps) => untrack(() => render(props, state));
    }
    return render ?? tag();
  });

  if ('enabled' in params) {
    return (
      <Show when={params.enabled ?? true}>
        <Element {...elementProps} />
      </Show>
    );
  }

  return <Element {...elementProps} />;
}

export type UseRenderRenderProp<State = Record<string, unknown>> = RenderProp<State>;

export type UseRenderElementProps<Tag extends IntrinsicTagName> = JSX.IntrinsicElements[Tag];

export type UseRenderComponentProps<
  Tag extends IntrinsicTagName,
  State = {},
  RenderFunctionProps = HTMLProps,
> = Omit<JSX.IntrinsicElements[Tag], 'render'> & {
  /**
   * Allows you to replace the component's HTML element
   * with a different tag, or compose it with another component.
   *
   * Accepts a tag name, or a function that receives the props to spread and the
   * state, and returns the element to render.
   */
  render?: IntrinsicTagName | ComponentRenderFn<RenderFunctionProps, State> | undefined;
};

export interface UseRenderParameters<State> {
  /**
   * A tag name or a function that returns the element to render, to override the default element.
   */
  render?: UseRenderRenderProp<State> | undefined;
  /**
   * The ref(s) to apply to the rendered element.
   */
  ref?: RefProp<any> | undefined;
  /**
   * The state of the component, passed as the second argument to the `render` callback.
   * State properties are automatically converted to data-* attributes.
   * Use getters to make it reactive.
   */
  state?: State | undefined;
  /**
   * Custom mapping for converting state properties to data-* attributes.
   * @example
   * { isActive: (value) => (value ? { 'data-is-active': '' } : null) }
   */
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  /**
   * Props to be spread on the rendered element.
   * They are merged with the internal props of the component, so that event handlers
   * are merged, `class` values are joined and `style` properties are merged, while other
   * external props overwrite the internal ones.
   * Accepts a props object or a props getter (see `mergeProps`).
   */
  props?: PropsSource<HTMLProps> | undefined;
  /**
   * If `false`, nothing is rendered.
   * This is useful for rendering a component conditionally.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * The default tag name to use for the rendered element when `render` is not provided.
   * @default 'div'
   */
  defaultTagName?: IntrinsicTagName | undefined;
}

export type UseRenderReturnValue = JSX.Element;

export interface UseRenderState {}

export namespace useRender {
  export type State = UseRenderState;
  export type RenderProp<TState = Record<string, unknown>> = UseRenderRenderProp<TState>;

  export type ElementProps<Tag extends IntrinsicTagName> = UseRenderElementProps<Tag>;

  export type ComponentProps<
    Tag extends IntrinsicTagName,
    TState = {},
    RenderFunctionProps = HTMLProps,
  > = UseRenderComponentProps<Tag, TState, RenderFunctionProps>;

  export type Parameters<TState> = UseRenderParameters<TState>;

  export type ReturnValue = UseRenderReturnValue;
}
