---
title: Tabs
description: A component for toggling between related panels on the same page.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Tabs } from '@egoist/solid-base/tabs';

<Tabs.Root>
  <Tabs.List>
    <Tabs.Tab />
    <Tabs.Indicator />
  </Tabs.List>
  <Tabs.Panel />
</Tabs.Root>;
```

## Examples

### Animated panels

Animate panels as they activate using the `data-starting-style` and `data-ending-style`
attributes. The `data-activation-direction` attribute indicates which direction the newly active
tab is relative to the previously active one, letting panels slide in from the correct side.

::demo{src="./demos/animated-panels.tsx"}

### Links

Use the `render` prop and set `nativeButton={false}` on `<Tabs.Tab>` to render tabs as anchor
elements. The function receives the props to spread on your link component:

```tsx title="Tabs as links"
import { Tabs } from '@egoist/solid-base/tabs';
import { A } from '@solidjs/router';

<Tabs.Root>
  <Tabs.List>
    <Tabs.Tab
      nativeButton={false}
      render={(props) => <A {...props} href="/overview" />}
      value="overview"
    >
      Overview
    </Tabs.Tab>
  </Tabs.List>
  {/* ... */}
</Tabs.Root>;
```

## API reference

::api
