---
title: Accordion
description: A set of collapsible panels with headings.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Accordion } from '@egoist/solid-base/accordion';

<Accordion.Root>
  <Accordion.Item>
    <Accordion.Header>
      <Accordion.Trigger />
    </Accordion.Header>
    <Accordion.Panel />
  </Accordion.Item>
</Accordion.Root>;
```

## Examples

### Open multiple panels

You can set up the accordion to allow multiple panels to be open at the same time using the
`multiple` prop.

::demo{src="./demos/multiple.tsx"}

### Hidden until found

The `hiddenUntilFound` prop hides closed panels with
[`hidden="until-found"`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden)
so the browser can search their contents and reveal the matching panel automatically. It can be
set on each `Accordion.Panel`, or once on `Accordion.Root` to apply to all panels.

To try it, press <kbd>Ctrl</kbd>+<kbd>F</kbd> (<kbd>Cmd</kbd>+<kbd>F</kbd> on macOS) and search
for "restocking" — the browser opens the closed panel containing the match. When
`hiddenUntilFound` is enabled, closed panels always remain mounted in the DOM, which also makes
their contents indexable by search engines.

Older browsers that don't support `hidden="until-found"` keep panels hidden until their trigger
opens them, and find-in-page skips over the contents.

::demo{src="./demos/hidden-until-found.tsx"}

### Controlled

Pass `value` (an array of the open items' values) and update it from `onValueChange`. Give each
`Accordion.Item` a `value` to identify it:

```tsx title="Controlled accordion"
const [value, setValue] = createSignal(['shipping']);

<Accordion.Root value={value()} onValueChange={(next) => setValue(next)}>
  <Accordion.Item value="shipping">{/* ... */}</Accordion.Item>
  <Accordion.Item value="returns">{/* ... */}</Accordion.Item>
</Accordion.Root>;
```

## API reference

::api
