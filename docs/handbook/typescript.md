---
title: TypeScript
description: A guide to using TypeScript with solid-base.
order: 6
---

## Namespaces

Types are organized in namespaces, merged with each part. Every part has two core types:

- `Props` (such as `Tooltip.Root.Props`)
- `State` (such as `Tooltip.Root.State`)

They are available on the namespace you import (`Tooltip.Root.Props`), and as flat named exports
from the same module (`TooltipRootProps`, `TooltipRootState`).

### Props

When creating wrapping components, you can use the `Props` type to accept all of the underlying
props for the component.

```tsx title="Prop types"
import { Tooltip } from '@egoist/solid-base/tooltip';

function MyTooltip(props: Tooltip.Root.Props) {
  return <Tooltip.Root {...props} />;
}
```

:::solid
Spread `props` as is — don't destructure them. To take some props out before spreading, use
`omit(props, 'a', 'b')` from `solid-js`, which keeps the rest reactive.
:::

### State

The `State` type is the internal state of the component. It is the argument of the function form
of `class`, `style` and `render`. For example, `Positioner` parts (such as `<Popover.Positioner>`)
have state that describes the position of the element in relation to their anchor.

```tsx title="Positioner state"
import type { HTMLProps } from '@egoist/solid-base';
import { Popover } from '@egoist/solid-base/popover';

function renderPositioner(props: HTMLProps, state: Popover.Positioner.State) {
  return (
    <div {...props}>
      <ul>
        <li>The popover is {state.open ? 'open' : 'closed'}</li>
        <li>I am on the {state.side} side of the anchor</li>
        <li>I am aligned at the {state.align} of the side</li>
        <li>The anchor is {state.anchorHidden ? 'hidden' : 'visible'}</li>
      </ul>
      {props.children}
    </div>
  );
}

<Popover.Positioner render={renderPositioner} />;
```

`state` is a live object: each expression in the JSX above updates when the property it reads
changes.

### Events

Types relating to change events are also exported on the parts' namespaces.

- `ChangeEventDetails` (such as `Combobox.Root.ChangeEventDetails`) is the object passed to change
  handlers like `onValueChange`.
- `OpenChangeEventDetails` (such as `Combobox.Root.OpenChangeEventDetails`) is the object passed to
  `onOpenChange` on components whose `ChangeEventDetails` is shared with other handlers. It extends
  `ChangeEventDetails` with `preventUnmountOnClose()`.
- `ChangeEventReason` (such as `Combobox.Root.ChangeEventReason`) is the union of possible reason
  strings for a change event.

```tsx title="Change event types"
import { Combobox } from '@egoist/solid-base/combobox';

function onValueChange(value: string, eventDetails: Combobox.Root.ChangeEventDetails) {
  console.log(value, eventDetails);
}

function onOpenChange(open: boolean, eventDetails: Combobox.Root.OpenChangeEventDetails) {
  console.log(open, eventDetails);
}
```

The generic `BaseUIChangeEventDetails` type, and `BaseUIEvent<E>` — a native event extended with
`preventBaseUIHandler()` — are exported from the root entry:

```ts
import type { BaseUIChangeEventDetails, BaseUIEvent } from '@egoist/solid-base';

function handleClick(event: BaseUIEvent<MouseEvent>) {
  event.preventBaseUIHandler();
}
```

### Other accessible types

Depending on the component API, other types are also exported on component parts or utility
functions. The following list is non-exhaustive, and each of these are documented where
necessary.

- Popups have an `actionsRef` prop to access imperative methods. For example, `Menu.Root.Actions`
  gives access to the shape of the `actionsRef` object prop on `<Menu.Root>`.
- The `toast` object on `<Toast.Root>` is a complex object with many properties.
  `Toast.Root.ToastObject` gives access to this interface.
- Components that have a `render` prop have Solid's intrinsic element props, enhanced with a
  `render` prop. The `useRender.ComponentProps` type gives access to this interface for your own
  components, and `HTMLProps` types the props a `render` function receives.
- Data attribute and CSS variable names are exported as constants, such as
  `MenuItemDataAttributes.highlighted` (`'data-highlighted'`) and
  `MenuPositionerCssVariables.availableHeight` (`'--available-height'`).

```tsx title="Typing a render prop for your own component"
import { useRender } from '@egoist/solid-base/use-render';

interface CounterState {
  odd: boolean;
}

interface CounterProps extends useRender.ComponentProps<'button', CounterState> {}
```
