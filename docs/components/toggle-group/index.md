---
title: Toggle Group
description: Provides a shared state to a series of toggle buttons.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and use it as a single part:

```tsx title="Anatomy"
import { ToggleGroup } from '@egoist/solid-base/toggle-group';

<ToggleGroup />;
```

The buttons inside are [Toggle](/components/toggle) components. Give each one a `value`: the
group's `value` is an array of the pressed toggles' values.

## Examples

### Multiple

Add the `multiple` prop to allow pressing more than one toggle at a time.

::demo{src="./demos/multiple.tsx"}

### Controlled

Pass `value` and update it from `onValueChange`:

```tsx title="Controlled toggle group"
const [value, setValue] = createSignal(['left']);

<ToggleGroup value={value()} onValueChange={(next) => setValue(next)}>
  <Toggle value="left">Left</Toggle>
  <Toggle value="right">Right</Toggle>
</ToggleGroup>;
```

## API reference

::api
