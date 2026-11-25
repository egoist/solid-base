import { Show, merge, untrack, type Accessor } from 'solid-js';
import { dynamic, type JSX } from '@solidjs/web';
import type { RefProp } from '@egoist/solid-base-utils/refs';
import { EMPTY_OBJECT } from '@egoist/solid-base-utils/empty';
import { createMergedView, type PropsSource } from '../merge-props/mergeProps';
import { resolveClassName } from '../utils/resolveClassName';
import { resolveStyle, type StyleProp } from '../utils/resolveStyle';
import {
  getStateAttributesProps,
  type StateAttributesMapping,
} from './getStateAttributesProps';
import type { ClassProp, HTMLProps, IntrinsicTagName, RenderProp } from './types';

/**
 * The props of a component that `renderElement` reads to customize rendering.
 */
export interface RenderElementComponentProps<State> {
  class?: ClassProp<State> | undefined;
  style?: StyleProp<State>;
  render?: RenderProp<State, any> | undefined;
}

export interface RenderElementParameters<State> {
  /**
   * The (reactive) state of the component. Each key is turned into a `data-*` attribute,
   * and the object is passed to the `class`, `style` and `render` callbacks.
   */
  state?: State | undefined;
  /**
   * Props to spread on the rendered element. Sources are merged with `mergeProps` semantics:
   * the rightmost source wins, handlers are chained, classes joined and styles merged.
   */
  props?: PropsSource<any> | readonly PropsSource<any>[] | undefined;
  /**
   * Refs to call with the rendered element.
   */
  ref?: RefProp<any> | undefined;
  /**
   * A mapping of state to `data-*` attributes.
   */
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  /**
   * When provided, the element is only rendered while it returns `true`.
   */
  enabled?: Accessor<boolean> | undefined;
}

const HIDDEN_KEYS: ReadonlySet<PropertyKey> = new Set(['render']);

/**
 * Builds the live props of a Base UI element: state data attributes, the given props, the
 * resolved `class`/`style` props of the component, and refs.
 */
export function createRenderElementProps<State extends object>(
  tag: IntrinsicTagName | undefined,
  componentProps: RenderElementComponentProps<State>,
  params: RenderElementParameters<State> = {},
): HTMLProps {
  const state = (params.state ?? EMPTY_OBJECT) as State;
  const mapping = params.stateAttributesMapping;

  const sources: PropsSource<any>[] = [];

  // Defaults of the default tag, like upstream's `renderTag`. They only exist while the default
  // tag renders: a `render` function receives no `type` key, so its own default applies.
  if (tag === 'button') {
    sources.push(merge(() => (componentProps.render == null ? { type: 'button' } : {})));
  } else if (tag === 'img') {
    sources.push(merge(() => (componentProps.render == null ? { alt: '' } : {})));
  }

  if (params.state) {
    sources.push(merge(() => getStateAttributesProps(state as any, mapping as any)));
  }

  if (Array.isArray(params.props)) {
    sources.push(...params.props);
  } else if (params.props) {
    sources.push(params.props as PropsSource<any>);
  }

  sources.push({
    get class() {
      return resolveClassName(componentProps.class, state);
    },
    get style() {
      return resolveStyle(componentProps.style, state);
    },
    ref: params.ref,
  });

  // Flatten function sources first (they receive the view merged so far).
  let list: Record<string, any>[] = [];
  for (const source of sources) {
    if (!source) {
      continue;
    }
    if (typeof source === 'function') {
      list = [source(createMergedView(list))];
    } else {
      list.push(source);
    }
  }

  // The tag arm of `dynamic` checks `'children' in props` inside its (tracked) memo. Answering
  // that check from the last source keeps it from reaching sources with a dynamic key set (such
  // as the state attributes), which would recreate the element whenever one of their keys
  // appears or disappears. The children themselves are still resolved lazily, in the insert
  // effect.
  const childrenView = createMergedView(list.slice());
  list.push({
    get children() {
      return childrenView.children;
    },
  });

  return createMergedView(list, HIDDEN_KEYS) as HTMLProps;
}

/**
 * Renders a Base UI element.
 *
 * @param tag The default HTML element to render. Can be overridden by the `render` prop.
 * @param componentProps The component props. Only `render`, `class` and `style` are read.
 * @param params Additional parameters for rendering the element.
 */
export function renderElement<State extends object>(
  tag: IntrinsicTagName,
  componentProps: RenderElementComponentProps<State>,
  params: RenderElementParameters<State> = {},
): JSX.Element {
  const props = createRenderElementProps(tag, componentProps, params);
  const state = (params.state ?? EMPTY_OBJECT) as State;

  const Element = dynamic(() => {
    const render = componentProps.render;
    if (typeof render === 'function') {
      return (elementProps: HTMLProps) => untrack(() => render(elementProps, state));
    }
    return render ?? tag;
  });

  if (params.enabled) {
    const enabled = params.enabled;
    return (
      <Show when={enabled()}>
        <Element {...props} />
      </Show>
    );
  }

  return <Element {...props} />;
}
