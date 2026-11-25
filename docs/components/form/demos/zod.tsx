import { createSignal } from 'solid-js';
import { Button } from '@egoist/solid-base/button';
import { Field } from '@egoist/solid-base/field';
import { Form } from '@egoist/solid-base/form';
import styles from './zod.module.css';

type FieldErrors = Record<string, string[]>;

/**
 * Stands in for `schema.safeParse()` + `z.flattenError()` so the demo has no dependencies:
 * it returns the same `{ fieldName: string[] }` shape as `fieldErrors`.
 */
function parse(values: Form.Values): FieldErrors {
  const errors: FieldErrors = {};
  if (String(values.name ?? '').trim().length < 1) {
    errors.name = ['Name is required'];
  }
  const age = Number(values.age);
  if (values.age === '' || Number.isNaN(age)) {
    errors.age = ['Age must be a number'];
  } else if (age <= 0) {
    errors.age = ['Age must be a positive number'];
  }
  return errors;
}

async function submitForm(formValues: Form.Values) {
  return { errors: parse(formValues) };
}

export default function ZodForm() {
  const [errors, setErrors] = createSignal<FieldErrors>({});

  return (
    <Form
      class={styles.Form}
      errors={errors()}
      onFormSubmit={async (formValues) => {
        const response = await submitForm(formValues);
        setErrors(response.errors);
      }}
    >
      <Field.Root name="name" class={styles.Field}>
        <Field.Label class={styles.Label}>Name</Field.Label>
        <Field.Control placeholder="Enter name" class={styles.Input} />
        <Field.Error class={styles.Error} />
      </Field.Root>
      <Field.Root name="age" class={styles.Field}>
        <Field.Label class={styles.Label}>Age</Field.Label>
        <Field.Control placeholder="Enter age" class={styles.Input} />
        <Field.Error class={styles.Error} />
      </Field.Root>
      <Button type="submit" class={styles.Button}>
        Submit
      </Button>
    </Form>
  );
}
