---
title: Radio
description: A radio button that is selected exclusively within a radio group.
---

::demo{src="../radio-group/demos/hero.tsx"}

## Usage guidelines

- **Place radios in a [Radio Group](/components/radio-group).** The group owns the selected value,
  the form `name`, and arrow-key navigation between its radios.
- **Form controls must have an accessible name.** It can be created using `<label>` elements, or
  the [Field](/components/field) and [Fieldset](/components/fieldset) components. See
  [Labeling a radio](#labeling-a-radio).

## Anatomy

Import the component and assemble its parts inside a radio group:

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

### Labeling a radio

An enclosing `<label>` is the simplest labeling pattern:

```tsx title="Using an enclosing label to label a radio button"
<label>
  <Radio.Root value="ssd">
    <Radio.Indicator />
  </Radio.Root>
  SSD
</label>
```

### Rendering as a native button

By default, `<Radio.Root>` renders a `<span>` element to support enclosing labels. Prefer
rendering each radio as a native button when using sibling labels (`for`/`id`):

::demo{src="./demos/native-button.tsx"}

Native buttons with wrapping labels are supported by using the `render` callback to avoid invalid
HTML, so the hidden input is placed outside the label:

```tsx title="Render callback"
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
```

### Animating the indicator

`<Radio.Indicator>` is only mounted while its radio is checked. It receives
`[data-starting-style]` and `[data-ending-style]` while it enters and leaves, so it can be
animated with CSS transitions. Pass `keepMounted` to keep it in the DOM instead:

```css
.Indicator {
  transition: scale 150ms;

  &[data-starting-style],
  &[data-ending-style] {
    scale: 0;
  }
}
```

## API reference

::api
