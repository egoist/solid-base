import { action, createOptimistic, createSignal } from 'solid-js';
import { Button } from '@egoist/solid-base/button';
import { Field } from '@egoist/solid-base/field';
import { Form } from '@egoist/solid-base/form';
import styles from './action.module.css';

interface FormState {
  serverErrors?: Form.Props['errors'];
}

export default function ActionForm() {
  const [errors, setErrors] = createSignal<Form.Props['errors']>({});
  // An optimistic flag: true while the action runs, reverts when it settles.
  const [pending, setPending] = createOptimistic(false);

  const submit = action(function* (formData: FormData) {
    setPending(true);
    const state: FormState = yield submitForm(formData);
    setErrors(state.serverErrors ?? {});
  });

  return (
    <Form
      errors={errors()}
      onSubmit={(event) => {
        event.preventDefault();
        submit(new FormData(event.currentTarget as HTMLFormElement));
      }}
      class={styles.Form}
    >
      <Field.Root name="username" class={styles.Field}>
        <Field.Label class={styles.Label}>Username</Field.Label>
        <Field.Control
          type="text"
          autocomplete="username"
          required
          defaultValue="admin"
          placeholder="e.g. alice132"
          class={styles.Input}
        />
        <Field.Error class={styles.Error} />
      </Field.Root>
      <Button type="submit" disabled={pending()} focusableWhenDisabled class={styles.Button}>
        Submit
      </Button>
    </Form>
  );
}

// In SolidStart, this could be a server function (`'use server'`).
async function submitForm(formData: FormData): Promise<FormState> {
  // Mimic a server response
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const username = formData.get('username') as string | null;

  if (username === 'admin') {
    return { serverErrors: { username: "'admin' is reserved for system use" } };
  }

  // 50% chance the username is taken
  if (Math.random() > 0.5) {
    return { serverErrors: { username: `${username} is unavailable` } };
  }

  return {};
}
