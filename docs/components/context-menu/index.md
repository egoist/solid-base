---
title: Context Menu
description: A menu that appears at the pointer on right click or long press.
---

::demo{src="./demos/hero.tsx"}

## Usage guidelines

- **Use context menus as an enhancement**: Don't make a context menu the only way to perform
  actions. Users may not discover or be able to open a context menu, especially on touch devices or
  with assistive technology. Always provide visible controls for the actions that are available in
  the context menu.

## Anatomy

Import the components and place them together:

```tsx title="Anatomy"
import { ContextMenu } from '@egoist/solid-base/context-menu';

<ContextMenu.Root>
  <ContextMenu.Trigger />
  <ContextMenu.Portal>
    <ContextMenu.Backdrop />
    <ContextMenu.Positioner>
      <ContextMenu.Popup>
        <ContextMenu.Arrow />
        <ContextMenu.Item />
        <ContextMenu.LinkItem />
        <ContextMenu.Separator />

        <ContextMenu.SubmenuRoot>
          <ContextMenu.SubmenuTrigger />
        </ContextMenu.SubmenuRoot>

        <ContextMenu.Group>
          <ContextMenu.GroupLabel />
        </ContextMenu.Group>

        <ContextMenu.RadioGroup>
          <ContextMenu.RadioItem>
            <ContextMenu.RadioItemIndicator />
          </ContextMenu.RadioItem>
        </ContextMenu.RadioGroup>

        <ContextMenu.CheckboxItem>
          <ContextMenu.CheckboxItemIndicator />
        </ContextMenu.CheckboxItem>
      </ContextMenu.Popup>
    </ContextMenu.Positioner>
  </ContextMenu.Portal>
</ContextMenu.Root>;
```

## Examples

[Menu](/components/menu#examples) displays additional demos, many of which apply to the context
menu as well.

### Nested menu

To create a submenu, create a `<ContextMenu.SubmenuRoot>` inside the parent context menu. Use the
`<ContextMenu.SubmenuTrigger>` part for the menu item that opens the nested menu.

::demo{src="./demos/submenu.tsx"}

## API reference

::api
