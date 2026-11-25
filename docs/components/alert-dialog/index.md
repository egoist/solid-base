---
title: Alert Dialog
description: A dialog that requires a user response to proceed.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { AlertDialog } from '@egoist/solid-base/alert-dialog';

<AlertDialog.Root>
  <AlertDialog.Trigger />
  <AlertDialog.Portal>
    <AlertDialog.Backdrop />
    <AlertDialog.Viewport>
      <AlertDialog.Popup>
        <AlertDialog.Title />
        <AlertDialog.Description />
        <AlertDialog.Close />
      </AlertDialog.Popup>
    </AlertDialog.Viewport>
  </AlertDialog.Portal>
</AlertDialog.Root>;
```

## Examples

### Detached triggers

An alert dialog can be controlled by a trigger located either inside or outside the
`<AlertDialog.Root>` component. For simple, one-off interactions, place the `<AlertDialog.Trigger>`
inside `<AlertDialog.Root>`, as shown in the example at the top of this page.

However, if defining the alert dialog's content next to its trigger is not practical, you can use a
detached trigger. This involves placing the `<AlertDialog.Trigger>` outside of `<AlertDialog.Root>`
and linking them with a `handle` created by the `AlertDialog.createHandle()` function.

The imperative methods on the handle, such as `open()` and `openWithPayload()`, require an
`<AlertDialog.Root>` using the same handle to be mounted. Calls made while no root is attached to
the handle — before one mounts, or after it unmounts — are ignored. Each time a root mounts, it
starts from fresh state: a call made while no root was attached is not replayed, and no open state
carries over from a previous mount.

```tsx title="Detached triggers"
const demoAlertDialog = AlertDialog.createHandle();

<AlertDialog.Trigger handle={demoAlertDialog}>Open</AlertDialog.Trigger>

<AlertDialog.Root handle={demoAlertDialog}>
  ...
</AlertDialog.Root>
```

::demo{src="./demos/detached-triggers-simple.tsx"}

### Multiple triggers

A single alert dialog can be opened by multiple trigger elements. You can achieve this by using the
same `handle` for several detached triggers, or by placing multiple `<AlertDialog.Trigger>`
components inside a single `<AlertDialog.Root>`.

```tsx title="Multiple triggers within the Root part"
<AlertDialog.Root>
  <AlertDialog.Trigger>Trigger 1</AlertDialog.Trigger>
  <AlertDialog.Trigger>Trigger 2</AlertDialog.Trigger>
  ...
</AlertDialog.Root>
```

```tsx title="Multiple detached triggers"
const demoAlertDialog = AlertDialog.createHandle();

<AlertDialog.Trigger handle={demoAlertDialog}>Trigger 1</AlertDialog.Trigger>
<AlertDialog.Trigger handle={demoAlertDialog}>Trigger 2</AlertDialog.Trigger>
<AlertDialog.Root handle={demoAlertDialog}>
  ...
</AlertDialog.Root>
```

The alert dialog can render different content depending on which trigger opened it. This is
achieved by passing a `payload` to the `<AlertDialog.Trigger>` and using the function-as-a-child
pattern in `<AlertDialog.Root>`.

The payload can be strongly typed by providing a type argument to the `createHandle()` function:

```tsx title="Detached triggers with payload"
const demoAlertDialog = AlertDialog.createHandle<{ message: string }>();

<AlertDialog.Trigger handle={demoAlertDialog} payload={{ message: 'Trigger 1' }}>
  Trigger 1
</AlertDialog.Trigger>

<AlertDialog.Trigger handle={demoAlertDialog} payload={{ message: 'Trigger 2' }}>
  Trigger 2
</AlertDialog.Trigger>

<AlertDialog.Root handle={demoAlertDialog}>
  {(state) => (
    <AlertDialog.Portal>
      <AlertDialog.Popup>
        <AlertDialog.Title>Alert dialog</AlertDialog.Title>
        <Show when={state.payload}>
          {(payload) => (
            <AlertDialog.Description>Confirming {payload().message}</AlertDialog.Description>
          )}
        </Show>
      </AlertDialog.Popup>
    </AlertDialog.Portal>
  )}
</AlertDialog.Root>
```

:::solid[Payload children run once]
The function child of `<AlertDialog.Root>` is called once, not every time the payload changes.
`payload` is a live getter: read it as `state.payload` inside JSX instead of destructuring
`({ payload })` in the parameter list, which would capture the value from the first render.
:::

### Controlled mode with multiple triggers

You can control the alert dialog's open state externally using the `open` and `onOpenChange` props
on `<AlertDialog.Root>`. This allows you to manage the alert dialog's visibility based on your
application's state. When using multiple triggers, you have to manage which trigger is active with
the `triggerId` prop on `<AlertDialog.Root>` and the `id` prop on each `<AlertDialog.Trigger>`.

Note that there is no separate `onTriggerIdChange` prop. Instead, the `onOpenChange` callback
receives an additional argument, `eventDetails`, which contains the trigger element that initiated
the state change.

::demo{src="./demos/detached-triggers-controlled.tsx"}

### Open from a menu

In order to open a dialog using a menu, control the dialog state and open it imperatively using the
`onClick` handler on the menu item.

::demo{src="./demos/open-from-menu.tsx"}

## API reference

`AlertDialog` shares the `Backdrop`, `Portal`, `Viewport`, `Popup`, `Title`, `Description` and
`Close` parts with [Dialog](/components/dialog). Unlike a dialog, an alert dialog is always modal
and can't be dismissed by clicking outside of it, so `<AlertDialog.Root>` has no `modal` or
`disablePointerDismissal` props.

::api

## createHandle

Creates an `AlertDialog.Handle` that connects an `<AlertDialog.Root>` with detached
`<AlertDialog.Trigger>` components. Pass a type argument to type the payload:
`AlertDialog.createHandle<Payload>()`.

### Handle

| Method / property          | Description                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open(triggerId)`          | Opens the alert dialog and associates it with the trigger that has this `id` (an `AlertDialog.Trigger` using this handle). Pass `null` to open without one. |
| `openWithPayload(payload)` | Opens the alert dialog with the given payload, without associating it with any trigger.                                                                      |
| `close()`                  | Closes the alert dialog.                                                                                                                                      |
| `isOpen`                   | Whether the alert dialog is currently open (`false` while no root is attached). Tracked when read in a reactive scope.                                       |

Call these methods from event handlers or effects, not while rendering.
