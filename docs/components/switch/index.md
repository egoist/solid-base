---
title: Switch
description: A control that indicates whether a setting is on or off.
---

::demo{src="./demos/hero.tsx"}

## Usage guidelines

- **Form controls must have an accessible name.** Wrap the switch in a `<label>`, or use the
  [Field](/components/field) component.

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Switch } from '@egoist/solid-base/switch';

<Switch.Root>
  <Switch.Thumb />
</Switch.Root>;
```

## Examples

### Labeling a switch

An enclosing `<label>` is the simplest labeling pattern:

```tsx
<label>
  <Switch.Root />
  Notifications
</label>
```

### Rendering as a native button

By default, `<Switch.Root>` renders a `<span>` so it can sit inside a label. When the label is a
sibling (`for`/`id`), render a native button instead:

```tsx
<label for="notifications-switch">Notifications</label>
<Switch.Root id="notifications-switch" nativeButton render="button">
  <Switch.Thumb />
</Switch.Root>
```

Native buttons with wrapping labels are supported by using the `render` callback to avoid invalid
HTML, so the hidden input is placed outside the label:

```tsx title="Render callback"
<Switch.Root
  nativeButton
  render={(buttonProps) => (
    <label>
      <button {...buttonProps} />
      Notifications
    </label>
  )}
/>
```

:::solid
The `render` callback is called **once**. The `props` and `state` it receives are live objects:
spread them, or read them inside JSX, rather than destructuring them.
:::

### Controlled

Pass `checked` and update it from `onCheckedChange`. The second argument carries the event
details, including `cancel()`:

```tsx
const [enabled, setEnabled] = createSignal(false);

<Switch.Root checked={enabled()} onCheckedChange={(checked) => setEnabled(checked)}>
  <Switch.Thumb />
</Switch.Root>;
```

## API reference

::api
