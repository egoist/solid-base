---
title: Number Field
description: A numeric input element with increment and decrement buttons, and a scrub area.
---

::demo{src="./demos/hero.tsx"}

## Usage guidelines

- **Form controls must have an accessible name.** It can be created using a `<label>` element or
  the [Field](/components/field) component.

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { NumberField } from '@egoist/solid-base/number-field';

<NumberField.Root>
  <NumberField.ScrubArea>
    <NumberField.ScrubAreaCursor />
  </NumberField.ScrubArea>
  <NumberField.Group>
    <NumberField.Decrement />
    <NumberField.Input />
    <NumberField.Increment />
  </NumberField.Group>
</NumberField.Root>;
```

## Examples

### Formatting

Pass `Intl.NumberFormat` options to `format` (and optionally a `locale`) to display currencies,
percentages or units. The input parses what users type back into a number:

```tsx
<NumberField.Root
  defaultValue={1299}
  format={{ style: 'currency', currency: 'USD' }}
  locale="en-US"
>
  {/* ... */}
</NumberField.Root>
```

### Controlled

Pass `value` and update it from `onValueChange`. The value is `null` when the input is empty. Use
`onValueCommitted` to react only when the user finishes an interaction (blur, a key press, or
releasing a button or the scrub area):

```tsx
const [amount, setAmount] = createSignal<number | null>(100);

<NumberField.Root value={amount()} onValueChange={(value) => setAmount(value)}>
  {/* ... */}
</NumberField.Root>;
```

## API reference

::api
