---
title: Form
description: A native form element with consolidated error handling.
---

::demo{src="./demos/hero.tsx"}

## Anatomy

Form is composed together with [Field](/components/field). Import the components and place them
together:

```tsx title="Anatomy"
import { Field } from '@egoist/solid-base/field';
import { Form } from '@egoist/solid-base/form';

<Form>
  <Field.Root>
    <Field.Label />
    <Field.Control />
    <Field.Error />
  </Field.Root>
</Form>;
```

## Examples

### Submit with an action

Wrap the submission in a Solid [`action`](https://docs.solidjs.com) to coordinate it as a
transition. A `createOptimistic(false)` flag set inside the action reads `true` while it runs and
reverts once it settles, which is all a pending button needs. Pass the errors the server returns
to `errors`; each one is shown by the `<Field.Error>` of the field with the matching `name`.

::demo{src="./demos/action.tsx"}

:::solid
Upstream submits through React's `useActionState` and a Server Function passed to `action`.
Solid has no `useActionState`: call your action (or a SolidStart server function) from `onSubmit`
instead, as above.
:::

### Submit form values as a JavaScript object

You can use `onFormSubmit` instead of the native `onSubmit` to access form values as a JavaScript
object. This is useful when you need to transform the values before submission, or integrate with
3rd party APIs.

```tsx title="Submission using onFormSubmit"
<Form
  onFormSubmit={async (formValues: { id: string; quantity: number }) => {
    const payload = {
      product_id: formValues.id,
      order_quantity: formValues.quantity,
    };

    const response = await fetch('https://api.example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }}
/>
```

When used, `preventDefault` is called on the native submit event.

### Using with Zod

When parsing the schema using `schema.safeParse()`, the `z.flattenError(result.error).fieldErrors`
data can be used to map the errors to each field's `name`:

```tsx title="Validating with Zod"
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.coerce.number('Age must be a number').positive('Age must be a positive number'),
});

async function submitForm(formValues: Form.Values) {
  const result = schema.safeParse(formValues);

  if (!result.success) {
    return { errors: z.flattenError(result.error).fieldErrors };
  }

  return { errors: {} };
}

const [errors, setErrors] = createSignal({});

<Form
  errors={errors()}
  onFormSubmit={async (formValues) => {
    const response = await submitForm(formValues);
    setErrors(response.errors);
  }}
>
  <Field.Root name="name">
    <Field.Label>Name</Field.Label>
    <Field.Control placeholder="Enter name" />
    <Field.Error />
  </Field.Root>
  <Field.Root name="age">
    <Field.Label>Age</Field.Label>
    <Field.Control placeholder="Enter age" />
    <Field.Error />
  </Field.Root>
  <Button type="submit">Submit</Button>
</Form>;
```

The live demo below swaps Zod for a small hand-written parser that returns the same
`fieldErrors` shape, so the docs don't depend on Zod:

::demo{src="./demos/zod.tsx"}

## API reference

::api
