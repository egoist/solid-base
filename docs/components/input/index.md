---
title: Input
description: A native input element that automatically works with Field.
---

::demo{src="./demos/hero.tsx"}

## Usage guidelines

- **Form controls must have an accessible name.** It can be created using a `<label>` element or
  the [Field](/components/field) component.

## Anatomy

Import the component and use it as a single part:

```tsx title="Anatomy"
import { Input } from '@egoist/solid-base/input';

<Input />;
```

## Examples

### Tracking the value

`onValueChange` fires on every keystroke with the input's string value, so you don't need to read
`event.currentTarget.value` from `onInput`:

```tsx
const [query, setQuery] = createSignal('');

<Input value={query()} onValueChange={(value) => setQuery(value)} />;
```

### Inside a field

When placed in a [Field](/components/field), `<Input>` is labeled by `<Field.Label>`, described by
`<Field.Description>`, and takes part in the field's validation and `data-*` state attributes:

```tsx
<Field.Root>
  <Field.Label>Email</Field.Label>
  <Input type="email" required />
  <Field.Error />
</Field.Root>
```

## API reference

::api
