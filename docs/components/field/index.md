---
title: Field
description: A component that provides labeling and validation for form controls.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Import the component and assemble its parts:

```tsx title="Anatomy"
import { Field } from '@egoist/solid-base/field';

<Field.Root>
  <Field.Label />
  <Field.Control />
  <Field.Description />
  <Field.Item />
  <Field.Error />
  <Field.Validity />
</Field.Root>;
```

## Examples

### Custom validation

Pass a `validate` function to `<Field.Root>` to run your own checks. Return an error message (or
an array of messages) when the value is invalid, and `null` when it is valid; `<Field.Error>`
without a `match` prop shows the returned message. `validationMode` controls when it runs:

```tsx
<Field.Root
  validationMode="onChange"
  validate={(value) => (String(value).length < 3 ? 'Use at least 3 characters' : null)}
>
  <Field.Label>Username</Field.Label>
  <Field.Control />
  <Field.Error />
</Field.Root>
```

### Reading validity

`<Field.Validity>` takes a function as its child and calls it with the field's validity state,
for rendering custom feedback:

```tsx
<Field.Validity>
  {(state) => <span>{state.validity.valid ? 'Looks good' : 'Not yet'}</span>}
</Field.Validity>
```

:::solid
Like other function children in Solid, the `state` argument is a live object: read its
properties inside JSX rather than destructuring them.
:::

## API reference

::api
