---
title: Toolbar
description: A container for grouping a set of buttons and controls.
---

::demo{src="./demos/hero.tsx"}

## Usage guidelines

To ensure that toolbars are accessible and helpful, follow these guidelines:

- **Use inputs sparingly**: Left and right arrow keys are used to both move the text insertion
  cursor in an input, and to navigate among controls in horizontal toolbars. When using an input
  in a horizontal toolbar, use only one and place it as the last element of the toolbar.

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Toolbar } from '@egoist/solid-base/toolbar';

<Toolbar.Root>
  <Toolbar.Button />
  <Toolbar.Link />
  <Toolbar.Separator />
  <Toolbar.Group>
    <Toolbar.Button />
    <Toolbar.Button />
  </Toolbar.Group>
  <Toolbar.Input />
</Toolbar.Root>;
```

## Examples

### Using with other components

Use the `render` prop to combine a toolbar part with a part from another component into a single
element. The element joins the toolbar's keyboard navigation and keeps the behavior of the other
part.

```tsx title="Using a menu in a toolbar"
<Toolbar.Root>
  <Menu.Root>
    <Toolbar.Button render={(props) => <Menu.Trigger {...props} />} />
    <Menu.Portal>{/* Compose the rest of the menu */}</Menu.Portal>
  </Menu.Root>
</Toolbar.Root>
```

- **Popups with a trigger**, such as Alert Dialog, Dialog, Drawer, Menu, Popover, and Select:
  render the trigger from the `render` function of `<Toolbar.Button>`, as shown above. Set
  `disabled` on `<Toolbar.Button>` rather than on the trigger, so the button stays in the
  toolbar's keyboard navigation.
- **Tooltip**: render `<Toolbar.Button>` from the `render` function of `<Tooltip.Trigger>`
  instead: `<Tooltip.Trigger render={(props) => <Toolbar.Button {...props} />} />`.
- **Number Field**: render `<NumberField.Input>` from the `render` function of `<Toolbar.Input>`,
  and keep it inside `<NumberField.Root>` and `<NumberField.Group>` with the increment and
  decrement buttons.

See [how props are merged](/handbook/composition#how-props-are-merged) for how the two parts
combine.

:::solid[Composing with `render` functions]
In React you would pass an element (`render={<Menu.Trigger />}`). In Solid, pass a function that renders
the other part and spreads the props it receives: `render={(props) => <Menu.Trigger {...props} />}`.
It is called once, with a live `props` object.
:::

## API reference

::api
