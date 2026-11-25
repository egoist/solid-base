---
title: Popover
description: An accessible popup anchored to a button.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Popover } from '@egoist/solid-base/popover';

<Popover.Root>
  <Popover.Trigger />
  <Popover.Portal>
    <Popover.Backdrop />
    <Popover.Positioner>
      <Popover.Popup>
        <Popover.Arrow />
        <Popover.Viewport>
          <Popover.Title />
          <Popover.Description />
          <Popover.Close />
        </Popover.Viewport>
      </Popover.Popup>
    </Popover.Positioner>
  </Popover.Portal>
</Popover.Root>;
```

## Examples

### Opening on hover

To open the popover on hover, set the `openOnHover` prop on the trigger.

Use the `delay` prop to specify how long to wait (in milliseconds) before the popover opens on
hover, and `closeDelay` for how long to wait before it closes.

::demo{src="./demos/open-on-hover.tsx"}

### Detached triggers

A popover can be controlled by a trigger located either inside or outside the `<Popover.Root>`
component. For simple, one-off interactions, place the `<Popover.Trigger>` inside
`<Popover.Root>`, as shown in the example at the top of this page.

However, if defining the popover's content next to its trigger is not practical, you can use a
detached trigger. This involves placing the `<Popover.Trigger>` outside of `<Popover.Root>` and
linking them with a `handle` created by the `Popover.createHandle()` function.

The imperative methods on the handle, such as `open()` and `close()`, require a `<Popover.Root>`
using the same handle to be mounted. Calls made while no root is attached to the handle — before
one mounts, or after it unmounts — are ignored. Each time a root mounts, it starts from fresh
state: a call made while no root was attached is not replayed, and no open state carries over
from a previous mount.

```tsx title="Detached triggers"
const demoPopover = Popover.createHandle();

<Popover.Trigger handle={demoPopover}>Trigger</Popover.Trigger>

<Popover.Root handle={demoPopover}>
  ...
</Popover.Root>
```

::demo{src="./demos/detached-triggers-simple.tsx"}

### Multiple triggers

A single popover can be opened by multiple trigger elements. You can achieve this by using the
same `handle` for several detached triggers, or by placing multiple `<Popover.Trigger>`
components inside a single `<Popover.Root>`.

```tsx title="Multiple triggers within the Root part"
<Popover.Root>
  <Popover.Trigger>Trigger 1</Popover.Trigger>
  <Popover.Trigger>Trigger 2</Popover.Trigger>
  ...
</Popover.Root>
```

```tsx title="Multiple detached triggers"
const demoPopover = Popover.createHandle();

<Popover.Trigger handle={demoPopover}>Trigger 1</Popover.Trigger>
<Popover.Trigger handle={demoPopover}>Trigger 2</Popover.Trigger>

<Popover.Root handle={demoPopover}>
  ...
</Popover.Root>
```

The popover can render different content depending on which trigger opened it. This is achieved
by passing a `payload` to the `<Popover.Trigger>` and using a function as the child of
`<Popover.Root>`.

The payload can be strongly typed by providing a type argument to the `createHandle()` function:

```tsx title="Detached triggers with payload"
const demoPopover = Popover.createHandle<{ text: string }>();

<Popover.Trigger handle={demoPopover} payload={{ text: 'Trigger 1' }}>
  Trigger 1
</Popover.Trigger>

<Popover.Trigger handle={demoPopover} payload={{ text: 'Trigger 2' }}>
  Trigger 2
</Popover.Trigger>

<Popover.Root handle={demoPopover}>
  {(state) => (
    <Popover.Portal>
      <Popover.Positioner sideOffset={8}>
        <Popover.Popup class={styles.Popup}>
          <Popover.Arrow class={styles.Arrow} />
          <Popover.Title class={styles.Title}>Popover</Popover.Title>
          <Show when={state.payload}>
            {(payload) => (
              <Popover.Description class={styles.Description}>
                This has been opened by {payload().text}
              </Popover.Description>
            )}
          </Show>
          <Popover.Close aria-label="Close" class={styles.Close}>
            <XIcon />
          </Popover.Close>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  )}
</Popover.Root>
```

:::solid[The function child runs once]
In React the function child re-renders whenever the payload changes. Here it is called **once**,
with an object whose `payload` property is a live getter. Read `state.payload` inside JSX (or a
`<Show>`/memo) instead of destructuring it in the parameter list — `({ payload }) => ...` would
capture the value at creation time and never update.
:::

### Controlled mode with multiple triggers

You can control the popover's open state externally using the `open` and `onOpenChange` props on
`<Popover.Root>`. This allows you to manage the popover's visibility based on your application's
state. When using multiple triggers, you have to manage which trigger is active with the
`triggerId` prop on `<Popover.Root>` and the `id` prop on each `<Popover.Trigger>`.

Note that there is no separate `onTriggerIdChange` prop. Instead, the `onOpenChange` callback
receives an additional argument, `eventDetails`, which contains the trigger element that initiated
the state change.

::demo{src="./demos/detached-triggers-controlled.tsx"}

### Animating the Popover

You can animate a popover as it moves between different trigger elements. This includes animating
its position, size, and content.

#### Position and size

To animate the popover's position, apply CSS transitions to the `left`, `right`, `top`, and
`bottom` properties of the **Positioner** part. To animate its size, transition the `width` and
`height` of the **Popup** part.

#### Content

The popover also supports content transitions. This is useful when different triggers display
different content within the same popover.

To enable content animations, wrap the content in the `<Popover.Viewport>` part. This part
provides features to create direction-aware animations. It renders a `div` with a
`data-activation-direction` attribute that indicates the new trigger's position relative to the
previous one. The value is a space-separated set of up to two tokens (one per axis) — `left` or
`right` for the horizontal axis and `up` or `down` for the vertical axis (for example,
`right down`). Match a single token with the `~=` attribute selector, such as
`[data-activation-direction~='right']`.

Inside the `<Popover.Viewport>`, the content is further wrapped in `div`s with data attributes to
help with styling:

- `data-current`: The currently visible content when no transitions are present or the incoming
  content.
- `data-previous`: The outgoing content during a transition.

You can use these attributes to style the enter and exit animations.

::demo{src="./demos/detached-triggers-full.tsx"}

:::solid[Viewport content is created per trigger]
The viewport's children are read again each time the active trigger changes, so the incoming
content is created anew while the outgoing content is kept as a snapshot in the
`[data-previous]` container. Pass data or components as the payload (this demo passes a component
and renders it with `<Dynamic component={state.payload} />`) rather than prebuilt JSX elements,
which are DOM nodes and can only be inserted in one place.
:::

## API reference

::api

The `Viewport` is optional — reach for it only when a single popup is opened by multiple triggers,
its content differs per trigger, and the switch between them is animated. When used, set
`width: var(--positioner-width)` and `height: var(--positioner-height)` on the `Positioner` so its
box is frozen to the measured size during the transition; otherwise content-driven resizing can
make the popup thrash or flip to another side.

### createHandle

`Popover.createHandle<Payload>()` creates a `Popover.Handle` that connects detached triggers to a
root. The handle exposes `open(triggerId)`, `close()` and a reactive `isOpen` getter.
