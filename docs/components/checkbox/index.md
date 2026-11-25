---
title: Checkbox
description: An easily stylable checkbox component.
---

::demo{src="./demos/hero.tsx"}

## Usage guidelines

- **Form controls must have an accessible name.** It can be created using a `<label>` element or
  the [Field](/components/field) component. See
  [Labeling a checkbox](#labeling-a-checkbox).

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Checkbox } from '@egoist/solid-base/checkbox';

<Checkbox.Root>
  <Checkbox.Indicator />
</Checkbox.Root>;
```

## Examples

### Labeling a checkbox

An enclosing `<label>` is the simplest labeling pattern:

```tsx title="Wrapping a label around a checkbox"
<label>
  <Checkbox.Root />
  Accept terms and conditions
</label>
```

### Rendering as a native button

By default, `<Checkbox.Root>` renders a `<span>` element to support enclosing labels. Prefer
rendering the checkbox as a native button when using sibling labels (`for`/`id`).

```tsx title="Sibling label pattern with a native button"
<div>
  <label for="notifications-checkbox">Enable notifications</label>
  <Checkbox.Root id="notifications-checkbox" nativeButton render="button">
    <Checkbox.Indicator />
  </Checkbox.Root>
</div>
```

Native buttons with wrapping labels are supported by using the `render` callback to avoid invalid
HTML, so the hidden input is placed outside the label:

```tsx title="Render callback"
<Checkbox.Root
  nativeButton
  render={(buttonProps) => (
    <label>
      <button {...buttonProps} />
      Enable notifications
    </label>
  )}
/>
```

:::solid
The `render` callback is called **once**. The `props` and `state` it receives are live objects:
spread them, or read them inside JSX, rather than destructuring them.
:::

### Indeterminate

Set `indeterminate` to show a mixed state. `<Checkbox.Indicator>` stays mounted while the checkbox
is indeterminate, and its `state.indeterminate` tells you which icon to render:

::demo{src="./demos/indeterminate.tsx"}

### Controlled

Pass `checked` and update it from `onCheckedChange`. The second argument carries the event
details, including `cancel()`:

```tsx
const [accepted, setAccepted] = createSignal(false);

<Checkbox.Root checked={accepted()} onCheckedChange={(checked) => setAccepted(checked)}>
  <Checkbox.Indicator />
</Checkbox.Root>;
```

## API reference

::api
