---
title: Composition
description: A guide to composing Solid Base components with your own Solid components.
order: 3
---

## Composing custom Solid components

Use the `render` prop to compose a part with your own Solid components.

For example, most triggers render a `<button>` by default. The code snippet below shows how to use
a custom button instead.

```tsx title="index.tsx"
<Menu.Trigger render={(props) => <MyButton {...props} size="md" />}>Open menu</Menu.Trigger>
```

The custom component must spread all the props it receives on its underlying DOM node — including
`ref`, which is an ordinary prop in Solid:

```tsx title="my-button.tsx"
import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';

interface MyButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md';
}

function MyButton(props: MyButtonProps) {
  const buttonProps = omit(props, 'size');
  return <button {...buttonProps} type={props.type ?? 'button'} data-size={props.size} />;
}
```

Set defaults such as `type` after the spread: the props a part passes include `type`, left
undefined when a custom element is rendered, so a default written before the spread would be
replaced.

:::solid[A function, not an element]
React's Base UI accepts an element (`render={<MyButton size="md" />}`) and clones it with the
part's props. Solid has no element cloning, so `render` takes a tag name or a function receiving
the props to spread and the component state. The function is called **once**; `props` and `state`
are live objects, so spread them and read them in JSX instead of destructuring.
:::

## Composing multiple components

In situations where you need to compose multiple components with custom Solid components, `render`
props can be nested as deeply as necessary. Each level spreads the props it receives into the next
part. Working with Tooltip is a common example.

::demo{src="./demos/composition.tsx"}

```tsx title="index.tsx"
<Dialog.Root>
  <Tooltip.Root>
    <Tooltip.Trigger
      render={(tooltipProps) => (
        <Dialog.Trigger
          {...tooltipProps}
          render={(dialogProps) => <MyButton {...dialogProps} size="md" />}
        />
      )}
    >
      Open dialog
    </Tooltip.Trigger>
    <Tooltip.Portal>…</Tooltip.Portal>
  </Tooltip.Root>
  <Dialog.Portal>…</Dialog.Portal>
</Dialog.Root>
```

## How props are merged

When a `render` function spreads the part's props and sets more props of its own, JSX applies
Solid's rules: a prop written after the spread replaces the spread one. Use
[`mergeProps`](/utils/merge-props) to combine both sets instead. For example, this toolbar button
renders a menu trigger:

```tsx title="index.tsx"
import { mergeProps } from '@egoist/solid-base/merge-props';

<Toolbar.Button
  class="toolbar-button"
  style={{ color: 'red', padding: '4px' }}
  onClick={handleToolbarClick}
  ref={toolbarButtonRef}
  render={(props) => (
    <Menu.Trigger
      {...mergeProps(props, {
        class: 'menu-trigger',
        style: { color: 'blue' },
        onClick: handleMenuClick,
        ref: menuTriggerRef,
      })}
    />
  )}
/>;
```

The rendered `<button>` gets:

- `class="menu-trigger toolbar-button"`: classes are joined, starting with the rightmost source's.
- `style={{ color: 'blue', padding: '4px' }}`: style objects are merged, and the rightmost
  source's values win.
- Both click handlers, starting with `handleMenuClick`. Calling
  [`event.preventBaseUIHandler()`](/handbook/customization#preventing-base-ui-from-handling-an-event)
  skips every handler that runs after it, so calling it in `handleMenuClick` also skips
  `handleToolbarClick`. Some parts call it internally.
- Both refs: `toolbarButtonRef` and `menuTriggerRef` receive the same element.

For other attributes set on both, such as `id` or `title`, the rightmost value wins. Component
props like `disabled` are read by each part separately, so a value passed to the inner part
doesn't override the outer part's own.

`mergeProps` returns a live view, not a copy: reading a merged prop reads its sources, so reactive
props stay reactive.

## Changing the default rendered element

You can also use the `render` prop to override the rendered element of the component.

For example, `<Accordion.Header>` renders an `<h3>` element by default. The code snippet below
shows how to render it as an `<h2>` element so that it fits the heading hierarchy of the page.

```tsx title="index.tsx"
import { Accordion } from '@egoist/solid-base/accordion';

export default () => (
  <Accordion.Root>
    <Accordion.Item>
      <Accordion.Header render="h2">
        <Accordion.Trigger>What is Solid Base?</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel>Solid Base is a library of unstyled Solid components.</Accordion.Panel>
    </Accordion.Item>
  </Accordion.Root>
);
```

Each component renders the most appropriate element by default, and in most cases, rendering a
different element is recommended only on a case-by-case basis.

## Render function

A function passed to `render` gives you complete control over spreading props, and also allows
you to render different content based on the component's state.

```tsx title="switch.tsx"
<Switch.Thumb
  render={(props, state) => (
    <span {...props}>
      <Show when={state.checked} fallback={<UncheckedIcon />}>
        <CheckedIcon />
      </Show>
    </span>
  )}
/>
```

Because the function runs once, branch on the state inside JSX (`<Show>`, `<Switch>`, a ternary
in an expression) rather than at the top of the function.

## Building your own components

The [`useRender`](/utils/use-render) primitive gives your own components the same `render` prop,
with state data attributes and props merging. Combine it with `mergeProps` to layer your default
props under the consumer's:

```tsx title="text.tsx"
import { omit } from 'solid-js';
import { mergeProps } from '@egoist/solid-base/merge-props';
import { useRender } from '@egoist/solid-base/use-render';

interface TextProps extends useRender.ComponentProps<'p'> {}

function Text(props: TextProps) {
  return useRender({
    defaultTagName: 'p',
    get render() {
      return props.render;
    },
    props: mergeProps({ class: 'text' }, omit(props, 'render')),
  });
}

<Text>Paragraph</Text>;
<Text render="span">Inline text</Text>;
<Text render={(props) => <strong {...props} />}>Important text</Text>;
```

`useRender` runs once and returns the element. Pass it live objects — a `render` getter and
`omit(props, 'render')` rather than destructured values — so it stays reactive.
