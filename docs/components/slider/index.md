---
title: Slider
description: An easily stylable range input.
---

::demo{src="./demos/hero.tsx"}

## Usage guidelines

- **Form controls must have an accessible name.** Prefer `<Slider.Label>`, or provide an
  `aria-label` on each `<Slider.Thumb>` when no visible label is rendered. See
  [Labeling a slider](#labeling-a-slider).

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Slider } from '@egoist/solid-base/slider';

<Slider.Root>
  <Slider.Label />
  <Slider.Value />
  <Slider.Control>
    <Slider.Track>
      <Slider.Indicator />
      <Slider.Thumb />
    </Slider.Track>
  </Slider.Control>
</Slider.Root>;
```

## Examples

### Labeling a slider

A single-thumb slider without a visible label (such as a volume control) can be labeled using
`aria-label` on `<Slider.Thumb>`:

```tsx title="Slider with invisible label"
<Slider.Root>
  <Slider.Control>
    <Slider.Track>
      <Slider.Indicator />
      <Slider.Thumb aria-label="Volume" />
    </Slider.Track>
  </Slider.Control>
</Slider.Root>
```

A visible label can be created using `<Slider.Label>`:

```tsx title="Slider with visible label"
<Slider.Root>
  <Slider.Label>Volume</Slider.Label>
  <Slider.Control>
    <Slider.Track>
      <Slider.Indicator />
      <Slider.Thumb />
    </Slider.Track>
  </Slider.Control>
</Slider.Root>
```

For a multi-thumb range slider with a visible label, add `aria-label` on each `<Slider.Thumb>` to
distinguish them:

```tsx title="Labeling multi-thumb range sliders"
<Slider.Root defaultValue={[25, 75]}>
  <Slider.Label>Price range</Slider.Label>
  <Slider.Control>
    <Slider.Track>
      <Slider.Indicator />
      <Slider.Thumb index={0} aria-label="Minimum price" />
      <Slider.Thumb index={1} aria-label="Maximum price" />
    </Slider.Track>
  </Slider.Control>
</Slider.Root>
```

### Range slider

To create a range slider:

1. Pass an array of values and place a `<Slider.Thumb>` for each value in the array
2. Additionally for server-side rendering, specify a numeric `index` for each thumb that
   corresponds to the index of its value in the value array

Thumbs can be configured to behave differently when they collide during pointer interactions
using the `thumbCollisionBehavior` prop on `<Slider.Root>`.

::demo{src="./demos/range-slider.tsx"}

### Steps

Use the `step` prop to snap the value to multiples of a given increment, and `largeStep` to
control the increment when using Page Up/Page Down or Shift + Arrow Up/Arrow Down.

::demo{src="./demos/steps.tsx"}

### Marks

Render your own tick marks, positioning each mark along the track as a percentage of the value
range.

::demo{src="./demos/marks.tsx"}

Marks are independent of the value's granularity—pair them with the [`step`](#steps) prop to snap
the thumb to each mark.

### Thumb alignment

Set `thumbAlignment="edge"` to inset the thumb such that its edge aligns with the edge of the
control when the value is at `min` or `max`, without overflowing the control like the default
`"center"` alignment.

A client-only alternative `thumbAlignment="edge-client-only"` can be used to reduce bundle size
but only renders after hydration.

::demo{src="./demos/edge-alignment.tsx"}

### Vertical

Set `orientation="vertical"` on `<Slider.Root>` to build a vertical slider.

::demo{src="./demos/vertical.tsx"}

### Controlled

Pass `value` and update it from `onValueChange`, which fires on every change while dragging. Use
`onValueCommitted` to react only when the interaction ends (pointer up or a key press):

```tsx
const [volume, setVolume] = createSignal(25);

<Slider.Root value={volume()} onValueChange={(value) => setVolume(value)}>
  {/* ... */}
</Slider.Root>;
```

## API reference

::api
