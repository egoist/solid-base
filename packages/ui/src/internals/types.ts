import type { JSX } from '@solidjs/web';
import type { BaseUIEvent, ComponentRenderFn, HTMLProps } from '../types';
import type { StyleProp } from '../utils/resolveStyle';

export type { HTMLProps, BaseUIEvent, ComponentRenderFn };

export interface FloatingUIOpenChangeDetails {
  open: boolean;
  reason: string;
  nativeEvent: Event;
  nested: boolean;
  triggerElement?: Element | undefined;
}

export type IntrinsicTagName = keyof JSX.IntrinsicElements & string;

interface BaseUIEventExtras {
  /**
   * Prevents the Base UI handlers that run after this one (the component's internal logic).
   */
  preventBaseUIHandler: () => void;
  readonly baseUIHandlerPrevented?: boolean | undefined;
}

type WithPreventBaseUIHandler<Handler> = Handler extends (event: infer E) => infer R
  ? (event: E & BaseUIEventExtras) => R
  : Handler;

/**
 * Adds `preventBaseUIHandler()` to the events received by the `on*` handlers of `Props`.
 */
export type WithBaseUIEvent<Props> = {
  [K in keyof Props]: K extends `on${string}` ? WithPreventBaseUIHandler<Props[K]> : Props[K];
};

/**
 * The `class` prop of Solid Base components: any Solid class value, or a function of the state.
 */
export type ClassProp<State> = JSX.ClassValue | ((state: State) => JSX.ClassValue);

/**
 * The `render` prop: a tag name, or a function receiving the props and state.
 */
export type RenderProp<State, RenderFunctionProps = HTMLProps> =
  | IntrinsicTagName
  | ComponentRenderFn<RenderFunctionProps, State>;

/**
 * Props shared by all Solid Base components.
 * Contains `class` (a class value or callback taking the component's state as an argument),
 * `style` and `render` (to customize rendering).
 */
export type BaseUIComponentProps<
  Tag extends IntrinsicTagName,
  State,
  RenderFunctionProps = HTMLProps,
> = Omit<WithBaseUIEvent<JSX.IntrinsicElements[Tag]>, 'class' | 'style'> & {
  /**
   * CSS class applied to the element, or a function that
   * returns a class based on the component's state.
   */
  class?: ClassProp<State> | undefined;
  /**
   * Allows you to replace the component's HTML element
   * with a different tag, or compose it with another component.
   *
   * Accepts a tag name, or a function that receives the props to spread and the
   * component's state, and returns the element to render.
   */
  render?: RenderProp<State, RenderFunctionProps> | undefined;
  /**
   * Style applied to the element, or a function that
   * returns a style based on the component's state.
   */
  style?: StyleProp<State>;
};

export interface NativeButtonProps {
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `render` prop.
   * Set to `false` if the rendered element is not a button (for example, `<div>`).
   * @default true
   */
  nativeButton?: boolean | undefined;
}

export interface NonNativeButtonProps {
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `render` prop.
   * Set to `true` if the rendered element is a native button.
   * @default false
   */
  nativeButton?: boolean | undefined;
}

/**
 * Simplifies the display of a type (without modifying it).
 */
export type Simplify<T> = T extends Function ? T : { [K in keyof T]: T[K] };

export type RequiredExcept<T, K extends keyof T> = Required<Omit<T, K>> & Pick<T, K>;

export type Orientation = 'horizontal' | 'vertical';
