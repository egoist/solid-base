---
title: Dialog
description: A popup that opens on top of the entire page.
---

::demo{src="./demos/hero.tsx"}

## Usage guidelines

- **Dialog doesn't support gestures:** Use [Drawer](/components/drawer) when you need gesture
  support or snap points. A panel that slides in from the edge of the screen and doesn't need
  gesture support is a positioned Dialog.

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Dialog } from '@egoist/solid-base/dialog';

<Dialog.Root>
  <Dialog.Trigger />
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Viewport>
      <Dialog.Popup>
        <Dialog.Title />
        <Dialog.Description />
        <Dialog.Close />
      </Dialog.Popup>
    </Dialog.Viewport>
  </Dialog.Portal>
</Dialog.Root>;
```

## Examples

### State

By default, Dialog is an uncontrolled component that manages its own state.

```tsx title="Uncontrolled dialog"
<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Popup>
      <Dialog.Title>Example dialog</Dialog.Title>
      <Dialog.Close>Close</Dialog.Close>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

Use `open` and `onOpenChange` props if you need to access or control the state of the dialog.
For example, you can control the dialog state in order to open it imperatively from another place
in your app.

```tsx title="Controlled dialog"
const [open, setOpen] = createSignal(false);

<Dialog.Root open={open()} onOpenChange={setOpen}>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Popup>
      <form
        // Close the dialog once the form data is submitted
        onSubmit={async (event) => {
          event.preventDefault();
          await submitData();
          setOpen(false);
        }}
      >
        ...
      </form>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>;
```

It's also common to use `onOpenChange` if your app needs to do something when the dialog is
closed or opened. This is recommended over an effect that watches the `open` signal.

```tsx title="Running code when dialog state changes"
<Dialog.Root
  open={open()}
  onOpenChange={(open) => {
    // Do stuff when the dialog is closed
    if (!open) {
      doStuff();
    }
    // Set the new state
    setOpen(open);
  }}
>
```

### Nested dialogs

You can nest dialogs within one another normally.

Use the `[data-nested-dialog-open]` selector and the `var(--nested-dialogs)` CSS variable to
customize the styling of the parent dialog. Backdrops of the child dialogs won't be rendered so
that you can present the parent dialog in a clean way behind the one on top of it.

::demo{src="./demos/nested.tsx"}

### Custom focus management

You can control where the focus goes when the dialog opens and closes using the `initialFocus`
and `finalFocus` props on the `<Dialog.Popup>` component.

You can also set these props to `false` to prevent focus from moving when the dialog opens or
closes, or to a function that returns the element to focus based on the interaction type.

::demo{src="./demos/focus-management.tsx"}

:::solid[Focus targets]
A focus target is an element, a ref object
(`{ current }`), `true`/`false`, or a function called when focus moves. A function that returns a
variable assigned with `ref={el}` is the simplest form, since it is read only once the popup has
rendered: `initialFocus={() => input}`.
:::

### Outside scroll dialog

The dialog can be made scrollable by using `<Dialog.Viewport>` as an outer scrollable container
for `<Dialog.Popup>` while the popup can extend past the bottom edge.

::demo{src="./demos/outside-scroll.tsx"}

### Inside scroll dialog

The dialog can be made scrollable by making an inner container scrollable while the popup stays
fully on screen. `<Dialog.Viewport>` is used as a positioning container for `<Dialog.Popup>`.

::demo{src="./demos/inside-scroll.tsx"}

### Placing elements outside the popup

When adding elements that should appear "outside" the colored popup area, continue to place them
inside `<Dialog.Popup>`, but create a child element that has the popup styles. This ensures they
are kept in the tab order and announced correctly by screen readers.

`<Dialog.Popup>` has `pointer-events: none`, while inner content (the colored popup and close
button) has `pointer-events: auto` so clicks on the backdrop continue to be registered.

::demo{src="./demos/uncontained.tsx"}

### Detached triggers

A dialog can be controlled by a trigger located either inside or outside the `<Dialog.Root>`
component. For simple, one-off interactions, place the `<Dialog.Trigger>` inside `<Dialog.Root>`,
as shown in the example at the top of this page.

However, if defining the dialog's content next to its trigger is not practical, you can use a
detached trigger. This involves placing the `<Dialog.Trigger>` outside of `<Dialog.Root>` and
linking them with a `handle` created by the `Dialog.createHandle()` function.

The imperative methods on the handle, such as `open()` and `openWithPayload()`, require a
`<Dialog.Root>` using the same handle to be mounted. Calls made while no root is attached to the
handle — before one mounts, or after it unmounts — are ignored. Each time a root mounts, it starts
from fresh state: a call made while no root was attached is not replayed, and no open state carries
over from a previous mount.

```tsx title="Detached triggers"
const demoDialog = Dialog.createHandle();

<Dialog.Trigger handle={demoDialog}>Open</Dialog.Trigger>

<Dialog.Root handle={demoDialog}>
  ...
</Dialog.Root>
```

::demo{src="./demos/detached-triggers-simple.tsx"}

### Multiple triggers

A single dialog can be opened by multiple trigger elements. You can achieve this by using the same
`handle` for several detached triggers, or by placing multiple `<Dialog.Trigger>` components inside
a single `<Dialog.Root>`.

```tsx title="Multiple triggers within the Root part"
<Dialog.Root>
  <Dialog.Trigger>Trigger 1</Dialog.Trigger>
  <Dialog.Trigger>Trigger 2</Dialog.Trigger>
  ...
</Dialog.Root>
```

```tsx title="Multiple detached triggers"
const demoDialog = Dialog.createHandle();

<Dialog.Trigger handle={demoDialog}>Trigger 1</Dialog.Trigger>
<Dialog.Trigger handle={demoDialog}>Trigger 2</Dialog.Trigger>
<Dialog.Root handle={demoDialog}>
  ...
</Dialog.Root>
```

The dialog can render different content depending on which trigger opened it. This is achieved by
passing a `payload` to the `<Dialog.Trigger>` and using the function-as-a-child pattern in
`<Dialog.Root>`.

The payload can be strongly typed by providing a type argument to the `createHandle()` function:

```tsx title="Detached triggers with payload"
const demoDialog = Dialog.createHandle<{ text: string }>();

<Dialog.Trigger handle={demoDialog} payload={{ text: 'Trigger 1' }}>
  Trigger 1
</Dialog.Trigger>

<Dialog.Trigger handle={demoDialog} payload={{ text: 'Trigger 2' }}>
  Trigger 2
</Dialog.Trigger>

<Dialog.Root handle={demoDialog}>
  {(state) => (
    <Dialog.Portal>
      <Dialog.Popup>
        <Dialog.Title>Dialog</Dialog.Title>
        <Show when={state.payload}>
          {(payload) => (
            <Dialog.Description>This has been opened by {payload().text}</Dialog.Description>
          )}
        </Show>
      </Dialog.Popup>
    </Dialog.Portal>
  )}
</Dialog.Root>
```

:::solid[Payload children run once]
The function child of `<Dialog.Root>` is called once, not every time the payload changes.
`payload` is a live getter: read it as `state.payload` inside JSX (or `<Show when={state.payload}>`)
instead of destructuring `({ payload })` in the parameter list, which would capture the value from
the first render.
:::

### Controlled mode with multiple triggers

You can control the dialog's open state externally using the `open` and `onOpenChange` props on
`<Dialog.Root>`. This allows you to manage the dialog's visibility based on your application's
state. When using multiple triggers, you have to manage which trigger is active with the
`triggerId` prop on `<Dialog.Root>` and the `id` prop on each `<Dialog.Trigger>`.

Note that there is no separate `onTriggerIdChange` prop. Instead, the `onOpenChange` callback
receives an additional argument, `eventDetails`, which contains the trigger element that initiated
the state change.

::demo{src="./demos/detached-triggers-controlled.tsx"}

### Open from a menu

In order to open a dialog using a menu, control the dialog state and open it imperatively using the
`onClick` handler on the menu item.

::demo{src="./demos/open-from-menu.tsx"}

## API reference

::api

## createHandle

Creates a `Dialog.Handle` that connects a `<Dialog.Root>` with detached `<Dialog.Trigger>`
components. Pass a type argument to type the payload: `Dialog.createHandle<Payload>()`.

### Handle

| Method / property          | Description                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open(triggerId)`          | Opens the dialog and associates it with the trigger that has this `id` (a `Dialog.Trigger` using this handle). Pass `null` to open without a trigger.   |
| `openWithPayload(payload)` | Opens the dialog with the given payload, without associating it with any trigger.                                                                       |
| `close()`                  | Closes the dialog.                                                                                                                                       |
| `isOpen`                   | Whether the dialog is currently open (`false` while no root is attached). Tracked when read in a reactive scope.                                        |

Call these methods from event handlers or effects, not while rendering.
