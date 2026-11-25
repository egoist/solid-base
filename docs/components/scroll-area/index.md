---
title: Scroll Area
description: A native scroll container with custom scrollbars.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { ScrollArea } from '@egoist/solid-base/scroll-area';

<ScrollArea.Root>
  <ScrollArea.Viewport>
    <ScrollArea.Content />
  </ScrollArea.Viewport>
  <ScrollArea.Scrollbar>
    <ScrollArea.Thumb />
  </ScrollArea.Scrollbar>
  <ScrollArea.Corner />
</ScrollArea.Root>;
```

## Examples

### Both scrollbars

Use `<ScrollArea.Corner>` to prevent the scrollbars from intersecting.

::demo{src="./demos/both.tsx"}

### Gradient scroll fade

Use the viewport overflow CSS variables to drive a CSS mask, which gradually increases the fade as
the user scrolls away from the edges.

```css title="scroll-fade.module.css"
.Viewport {
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    black min(40px, var(--scroll-area-overflow-y-start)),
    black calc(100% - min(40px, var(--scroll-area-overflow-y-end, 40px))),
    transparent 100%
  );
  mask-repeat: no-repeat;
}
```

For SSR, a fallback can be used as part of the end-side `var()` call so the mask is visible
before the overflow CSS variables hydrate.

```css title="SSR fallback"
var(--scroll-area-overflow-y-end, 40px);
```

When the fade is applied to `<ScrollArea.Viewport>` itself, the variables can be used directly.
However, inheritance to children is disabled, so they must explicitly opt in using the `inherit`
keyword.

```css title="Child element opt-in"
.Child {
  --scroll-area-overflow-y-start: inherit;
  --scroll-area-overflow-y-end: inherit;
}
```

::demo{src="./demos/scroll-fade.tsx"}

## API reference

::api
