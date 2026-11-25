---
title: useRender
description: A primitive for enabling a render prop in custom components.
---

The `useRender` primitive lets you build custom components that provide a `render` prop to
override the default rendered element.

```tsx title="Import"
import { useRender } from '@egoist/solid-base/use-render';
```

## Examples

A `render` prop for a custom Text component lets consumers use it to replace the default rendered
`p` element with a different tag or component.

::demo{src="./demos/render.tsx"}

The callback version of the `render` prop enables more control of how props are spread, and also
passes the internal `state` of a component.

::demo{src="./demos/render-callback.tsx"}

:::solid[Keep props live]
`useRender` returns the element and runs once. Pass it live objects so it stays reactive: read
`render` through a getter (`get render() { return props.render; }`), pass the rest of the props
with `omit(props, 'render')` instead of destructuring, and give `state` getters. The `render`
callback is called once with live `props` and `state`: read them inside JSX.
:::

## Merging props

The [`mergeProps`](/utils/merge-props) function merges two or more sets of props together. It
safely merges four kinds of props:

1. Event handlers, so that all are invoked
2. `class` values
3. `style` properties
4. `ref`s, so that all receive the element

`mergeProps` merges objects from left to right, so that subsequent objects' properties in the
arguments overwrite previous ones. Merging props is useful when creating custom components, as
well as inside the callback version of the `render` prop for any component.

```tsx title="Using mergeProps in the render callback"
import { mergeProps } from '@egoist/solid-base/merge-props';
import styles from './index.module.css';

function Button() {
  return (
    <Component
      render={(props, state) => <button {...mergeProps(props, { class: styles.Button })} />}
    />
  );
}
```

## Merging refs

When building custom components, you often need to control a ref internally while still letting
external consumers pass their own — merging refs lets both parties have access to the underlying
DOM element. The `ref` option in `useRender` enables this: it is merged with the `ref` found in
`props`, and accepts a single ref callback or an array of them.

```tsx title="Merging an internal ref"
function Text(props: TextProps) {
  let internalElement: HTMLElement | undefined;

  return useRender({
    defaultTagName: 'p',
    ref: (element: HTMLElement) => {
      internalElement = element;
    },
    get render() {
      return props.render;
    },
    props: omit(props, 'render'),
  });
}
```

The consumer's `ref` stays in `props` and is called with the same element. There is no
`forwardRef`: `ref` is an ordinary prop in Solid.

## TypeScript

To type props, there are two interfaces:

- `useRender.ComponentProps` for a component's external (public) props. It types the `render`
  prop and HTML attributes.
- `useRender.ElementProps` for the element's internal (private) props. It types HTML attributes
  alone.

```tsx title="Typing props"
interface ButtonProps extends useRender.ComponentProps<'button'> {}

function Button(props: ButtonProps) {
  const defaultProps: useRender.ElementProps<'button'> = {
    class: styles.Button,
    type: 'button',
    children: 'Click me',
  };

  return useRender({
    defaultTagName: 'button',
    get render() {
      return props.render;
    },
    props: mergeProps(defaultProps, omit(props, 'render')),
  });
}
```

`useRender.ComponentProps` takes the component's state as its second type argument, which types
the `state` argument of the `render` callback: `useRender.ComponentProps<'button', CounterState>`.

## Migrating from `asChild`

Some libraries use an `asChild` prop, implemented with a `Slot` component that merges the
component's props into its only child. This library uses a `render` prop instead: learn more
about how it works in the [composition guide](/handbook/composition).

```tsx title="An asChild prop"
function Button(props) {
  const Comp = props.asChild ? Slot : 'button';
  return <Dynamic component={Comp} {...props} />;
}

// Usage
<Button asChild>
  <MyButton class="primary">Submit</MyButton>
</Button>;
```

`useRender` lets you implement a `render` prop. The example below is the equivalent
implementation to the example above.

```tsx title="A render prop"
import { omit } from 'solid-js';
import { useRender } from '@egoist/solid-base/use-render';

function Button(props: useRender.ComponentProps<'button'>) {
  return useRender({
    defaultTagName: 'button',
    get render() {
      return props.render;
    },
    props: omit(props, 'render'),
  });
}

// Usage
<Button render={(props) => <MyButton {...props} class="primary" />}>Submit</Button>;
```

## Render prop and polymorphism

The `render` prop is primarily designed for composing event handlers and behavioral props. In
most cases it should render the same tag as the default element.

Using `render` for polymorphism (rendering a different tag) requires more care, as some default
props may not be valid on the new element. For example, `type="button"` is only valid on a
`<button>`. Since the component can't know what element `render` will produce at render time and
before hydration, props like these need an explicit signal. This is why
[Button](/components/button) provides a `nativeButton` prop to control which defaults are
applied.

## API reference

```tsx title="Usage"
const element = useRender({
  // Input parameters
});
```

### Parameters

`render`, `defaultTagName`, `enabled` and `ref` are read lazily, so they can be getters. `props`
and `state` are read once: pass live objects to keep them reactive.

- **`defaultTagName`** `keyof JSX.IntrinsicElements` — The tag name to render when `render` is not provided. Defaults to `'div'`.
- **`render`** `keyof JSX.IntrinsicElements | ((props, state) => JSX.Element)` — A tag name, or a function that receives the props to spread and the state and returns the element to render. The function is called once.
- **`props`** `PropsSource<HTMLProps>` — Props to spread on the rendered element. A props object or a props getter (see [`mergeProps`](/utils/merge-props)).
- **`ref`** `Ref | Ref[]` — The ref(s) to apply to the rendered element, merged with `props.ref`.
- **`state`** `State` — The state of the component, passed as the second argument to the `render` callback. Its properties become `data-*` attributes. Use getters to make it reactive.
- **`stateAttributesMapping`** `StateAttributesMapping<State>` — Custom mapping from state properties to `data-*` attributes, e.g. `{ isActive: (value) => (value ? { 'data-is-active': '' } : null) }`.
- **`enabled`** `boolean` — If `false`, nothing is rendered. Defaults to `true`.

### Return value

| Type          | Description                                                                         |
| ------------- | ----------------------------------------------------------------------------------- |
| `JSX.Element` | The element to render: return it from your component, or insert it in its JSX. |
