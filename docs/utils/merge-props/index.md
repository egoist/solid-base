---
title: mergeProps
description: A utility to merge multiple sets of Solid props.
---

`mergeProps` helps you combine multiple prop objects (for example, internal props + user props)
into a single set of props you can spread onto an element. It behaves like `Object.assign`
(rightmost wins) with a few special cases, so common patterns work as expected.

```tsx title="Import"
import { mergeProps } from '@egoist/solid-base/merge-props';
```

## How merging works

- For most keys (everything except `class`, `style`, `ref`, and event handlers), the value from
  the rightmost object wins:
  ```ts title="returns { id: 'b', dir: 'ltr' }"
  mergeProps({ id: 'a', dir: 'ltr' }, { id: 'b' });
  ```
- `ref` values are all kept: the merged ref calls every ref with the element:
  ```ts title="refA and refB both receive the element"
  mergeProps({ ref: refA }, { ref: refB });
  ```
- `class` values are joined right-to-left (rightmost first). Any Solid class value works
  (strings, arrays, `{ name: boolean }` objects); the result is a class value Solid accepts:
  ```ts title="class is ['b', 'a']"
  mergeProps({ class: 'a' }, { class: 'b' });
  ```
- `style` objects (or strings) are merged, with keys from the rightmost style overwriting earlier
  ones.
- Event handlers are merged and executed right-to-left (rightmost first):

  ```ts title="b runs before a"
  mergeProps({ onClick: a }, { onClick: b });
  ```

  - For DOM events, the event gets an `event.preventBaseUIHandler()` method. Calling it prevents
    the handlers to its left (usually the component's internal logic) from running. This does not
    call `preventDefault()` or `stopPropagation()`.
  - For callbacks whose first argument isn't an event (such as `onValueChange(value)`), this
    mechanism isn't available and all handlers always execute.

:::solid[A live view, not a copy]
The result is a proxy that reads from the sources when a key is accessed, so getters in the
sources (`get disabled() { return props.disabled }`) stay reactive. Spread it in JSX
(`<button {...merged} />`) rather than destructuring it. Unlike Base UI, every `ref` is called,
not only the rightmost one.
:::

### Preventing Base UI's default behavior

When using the function form of the `render` prop, you spread the props yourself. Use
`mergeProps` to combine the component's props with your own, and call `preventBaseUIHandler()`
to stop the component's internal logic from running:

::demo{src="./demos/prevent-base-ui-handler.tsx"}

## Passing a function instead of an object

Each argument can be a props object or a function that receives the merged props up to that
point (left to right) and returns a props object. This is useful when you need to compute the
next props from whatever has already been merged.

Note that the function's return value completely replaces the accumulated props up to that
point. If you want to chain event handlers from the previous props, you must call them manually:

```tsx title="Manually chaining handlers in a function"
const merged = mergeProps(
  {
    onClick(event: MouseEvent) {
      // Handler from previous props
    },
  },
  (props) => ({
    onClick(event: MouseEvent) {
      // Manually call the previous handler
      props.onClick?.(event);
      // Your logic here
    },
  }),
);
```

The function is called once, immediately, with a live view of the props merged so far. To forward
a reactive prop, return a getter (`get disabled() { return props.disabled; }`) rather than its
current value.

## API reference

### mergeProps

Accepts any number of arguments, each being a props object, a function that returns a props
object, or a falsy value (skipped).

```ts title="Signature"
function mergeProps<P extends Record<string, any> = Record<string, any>>(
  ...sources: PropsSource<any>[]
): P;

type PropsSource<P> = P | ((mergedSoFar: P) => P) | null | undefined | false;
```

| Parameter | Type            | Description                                                         |
| --------- | --------------- | ------------------------------------------------------------------- |
| `sources` | `PropsSource[]` | Props objects or functions, merged left to right (rightmost wins). |

| Returns | Description                                                  |
| ------- | ------------------------------------------------------------ |
| `P`     | A live, read-only view of the merged props, to spread in JSX. |

### mergePropsN

Same as `mergeProps`, but accepts an array of sources. Use it when the sources are built
dynamically.

```ts title="Signature"
function mergePropsN<P extends Record<string, any> = Record<string, any>>(
  sources: readonly PropsSource<any>[],
): P;
```
