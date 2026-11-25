---
title: Menubar
description: A menu bar providing commands and options for your application.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Menubar } from '@egoist/solid-base/menubar';
import { Menu } from '@egoist/solid-base/menu';

<Menubar>
  <Menu.Root>
    <Menu.Trigger />
    <Menu.Portal>
      <Menu.Backdrop />
      <Menu.Positioner>
        <Menu.Popup>
          <Menu.Arrow />
          <Menu.Item />
          <Menu.LinkItem />
          <Menu.Separator />

          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger />
          </Menu.SubmenuRoot>

          <Menu.Group>
            <Menu.GroupLabel />
          </Menu.Group>

          <Menu.RadioGroup>
            <Menu.RadioItem>
              <Menu.RadioItemIndicator />
            </Menu.RadioItem>
          </Menu.RadioGroup>

          <Menu.CheckboxItem>
            <Menu.CheckboxItemIndicator />
          </Menu.CheckboxItem>

          <Menu.Viewport />
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</Menubar>;
```

Each menu in the bar is a regular [Menu](/components/menu): every part and example on that page
applies here. Once one menu is open, hovering or pressing the arrow keys moves to the neighboring
menus.

## API reference

::api
