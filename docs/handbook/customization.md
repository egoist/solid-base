---
title: Customization
description: A guide to customizing the behavior of Solid Base components.
order: 4
---

## Change events

Change events such as `onOpenChange`, `onValueChange` and `onPressedChange` are custom to the
components. They can be emitted by various different DOM events, effects, or even during
rendering.

```ts title="Change event signatures"
onOpenChange: (open, eventDetails) => void
onValueChange: (value, eventDetails) => void
onPressedChange: (pressed, eventDetails) => void
```

The `eventDetails` object is passed as a second argument to change event handlers. This enables
the event to be customized, and also allows you to conditionally run side effects based on the
reason or DOM event that caused the change.

```ts title="eventDetails object"
interface BaseUIChangeEventDetails {
  reason: string;
  event: Event;
  cancel: () => void;
  allowPropagation: () => void;
  isCanceled: boolean;
  isPropagationAllowed: boolean;
  trigger: Element | undefined;
}
```

- `reason` is used to determine why the change event occurred, which can be useful to
  conditionally run certain side effects. Most IDEs show the possible string values after typing
  `reason === '`.
- `event` is the native DOM event that caused the change. Its type is narrowed by `reason`, for
  example a `KeyboardEvent` for `'escape-key'`.
- `cancel` stops the component from changing its internal state.
- `allowPropagation` allows the DOM event to propagate in cases where the component stops the
  propagation.
- `isCanceled` indicates whether the change event has been canceled.
- `isPropagationAllowed` indicates whether the DOM event is allowed to propagate.
- `trigger` is the element that triggered the event, if applicable, such as the trigger a popup
  was opened from.

### Canceling a change event

An event can be canceled with the `cancel()` method on `eventDetails`:

```tsx title="Prevent a tooltip from closing when pressing the trigger"
<Tooltip.Root
  onOpenChange={(open, eventDetails) => {
    if (eventDetails.reason === 'trigger-press') {
      // Stop the open change (false) from happening.
      eventDetails.cancel();
    }
  }}
>
  …
</Tooltip.Root>
```

This lets you leave the component uncontrolled as its internal state is prevented from updating.
This is an alternative to controlling the component with external state and guarding the state
updates conditionally. When the component is controlled, `cancel()` is still the way to decline a
change: a request that is ignored instead stays pending until the `open` prop changes, so a later
close is still reported.

The popover below cancels close requests that come from outside of it — an `'outside-press'`, or
the `'focus-out'` that follows it — while the switch is on:

::demo{src="./demos/customization.tsx"}

### Allowing propagation of the DOM event

In most components, pressing the **Esc** key stops the propagation of the event so parent popups
don't close simultaneously. This can also be customized with the `allowPropagation()` method:

```tsx title="Allowing propagation of the event"
<Tooltip.Root
  onOpenChange={(open, eventDetails) => {
    if (eventDetails.reason === 'escape-key') {
      // Allow the DOM event to propagate.
      eventDetails.allowPropagation();
    }
  }}
>
  …
</Tooltip.Root>
```

## Preventing Base UI from handling an event

To prevent a component from handling a DOM event like `onClick`, call the
`preventBaseUIHandler()` method on the event object in your handler:

```tsx title="Prevent the default behavior"
<NumberField.Input
  onPaste={(event) => {
    event.preventBaseUIHandler();
  }}
/>
```

This works because your handlers run before the component's internal ones. It lets your handler
take over the interaction, and pairs well with [controlled state](#controlling-components-with-state)
to tailor a component's behavior to your app. If the interaction triggers a change event,
[canceling it](#canceling-a-change-event) for a specific `reason` is more explicit.

In various cases, components listen to events with `addEventListener` (on the document, or for
capture-phase listeners) rather than through props, so `preventBaseUIHandler()` has no effect on
them.

:::solid[Native events]
Handlers receive native DOM events, extended with `preventBaseUIHandler()`. Type a handler's event
with `BaseUIEvent<MouseEvent>` from `@egoist/solid-base` when you write it outside of JSX.
:::

Inside a `render` function, add your handler with [`mergeProps`](/utils/merge-props) so the
component's handler still runs after it — a plain `onClick` after the spread would replace it:

```tsx
import type { BaseUIEvent } from '@egoist/solid-base';
import { mergeProps } from '@egoist/solid-base/merge-props';

<Toggle
  render={(props) => (
    <button
      {...mergeProps(props, {
        onClick(event: BaseUIEvent<MouseEvent>) {
          if (locked()) {
            event.preventBaseUIHandler();
          }
        },
      })}
    />
  )}
/>;
```

## Controlling components with state

Change event handlers enable a component to be controlled with your own external state.

Components are uncontrolled by default, meaning that they manage their own state internally.

```tsx title="Uncontrolled dialog"
<Dialog.Root>
  <Dialog.Trigger /> {/* Opens the dialog when clicked. */}
</Dialog.Root>
```

A component can be made controlled by passing external state to a prop, such as `open` or
`value`, and updating that state from its corresponding change handler, such as `onOpenChange` or
`onValueChange`.

For instance, you can open a [Dialog](/components/dialog) after a timeout, without a trigger:

```tsx title="Controlled dialog"
import { createSignal, onSettled } from 'solid-js';

function DelayedDialog() {
  const [open, setOpen] = createSignal(false);

  onSettled(() => {
    const timeout = setTimeout(() => setOpen(true), 1000);
    return () => clearTimeout(timeout);
  });

  return (
    <Dialog.Root open={open()} onOpenChange={(next) => setOpen(next)}>
      No trigger is needed in this case.
    </Dialog.Root>
  );
}
```

This also allows you to read the state of the component outside of the root component.

:::solid
Pass the signal's value (`open={open()}`), not the accessor. Since props are read lazily, the
component tracks the signal through the prop.
:::
