---
title: Radio Group
description: Provides shared state to a series of radio buttons.
---

::demo{src="./demos/hero.tsx"}

## Usage guidelines

- **Form controls must have an accessible name.** It can be created using `<label>` elements, or
  the [Field](/components/field) and [Fieldset](/components/fieldset) components. See
  [Labeling a radio group](#labeling-a-radio-group).

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Radio } from '@egoist/solid-base/radio';
import { RadioGroup } from '@egoist/solid-base/radio-group';

<RadioGroup>
  <Radio.Root>
    <Radio.Indicator />
  </Radio.Root>
</RadioGroup>;
```

## Examples

### Labeling a radio group

Label the group with `aria-labelledby` and a sibling label element:

```tsx title="Using aria-labelledby to label a radio group"
<div id="storage-type-label">Storage type</div>
<RadioGroup aria-labelledby="storage-type-label">{/* ... */}</RadioGroup>
```

An enclosing `<label>` is the simplest labeling pattern for each radio:

```tsx title="Using an enclosing label to label a radio button"
<label>
  <Radio.Root value="ssd" />
  SSD
</label>
```

### Rendering as a native button

By default, `<Radio.Root>` renders a `<span>` element to support enclosing labels. Prefer
rendering each radio as a native button when using sibling labels (`for`/`id`).

```tsx title="Sibling label pattern with a native button"
<div id="storage-type">Storage type</div>
<RadioGroup defaultValue="ssd" aria-labelledby="storage-type">
  <div>
    <label for="storage-type-ssd">SSD</label>
    <Radio.Root value="ssd" id="storage-type-ssd" nativeButton render="button">
      <Radio.Indicator />
    </Radio.Root>
  </div>
</RadioGroup>
```

Native buttons with wrapping labels are supported by using the `render` callback to avoid invalid
HTML, so the hidden input is placed outside the label:

```tsx title="Render callback"
<div id="storage-type">Storage type</div>
<RadioGroup defaultValue="ssd" aria-labelledby="storage-type">
  <Radio.Root
    value="ssd"
    nativeButton
    render={(buttonProps) => (
      <label>
        <button {...buttonProps} />
        SSD
      </label>
    )}
  />
</RadioGroup>
```

### Controlled

Pass `value` and update it from `onValueChange`:

```tsx
const [storage, setStorage] = createSignal('ssd');

<RadioGroup value={storage()} onValueChange={(value) => setStorage(value)}>
  {/* ... */}
</RadioGroup>;
```

## API reference

::api

The radio buttons inside the group are documented on the [Radio](/components/radio) page:

::api{module="radio"}
