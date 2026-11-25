import { createSignal } from 'solid-js';
import { Button } from '@egoist/solid-base/button';
import { Field } from '@egoist/solid-base/field';
import { Form } from '@egoist/solid-base/form';
import styles from './hero.module.css';

export default function FormDemo() {
  const [errors, setErrors] = createSignal<Form.Props['errors']>({});
  const [loading, setLoading] = createSignal(false);

  return (
    <Form
      class={styles.Form}
      errors={errors()}
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        const value = formData.get('url') as string;

        setLoading(true);
        const response = await submitForm(value);
        setErrors(response.error ? { url: response.error } : {});
        setLoading(false);
      }}
    >
      <Field.Root name="url" class={styles.Field}>
        <Field.Label class={styles.Label}>Homepage</Field.Label>
        <Field.Control
          type="url"
          required
          defaultValue="https://example.com"
          placeholder="https://example.com"
          pattern="https?://.*"
          class={styles.Input}
        />
        <Field.Error class={styles.Error} />
      </Field.Root>
      <Button type="submit" disabled={loading()} focusableWhenDisabled class={styles.Button}>
        Submit
      </Button>
    </Form>
  );
}

async function submitForm(value: string): Promise<{ error?: string }> {
  // Mimic a server response
  await new Promise((resolve) => setTimeout(resolve, 1000));

  try {
    const url = new URL(value);
    if (url.hostname.endsWith('example.com')) {
      return { error: 'The example domain is not allowed' };
    }
  } catch {
    return { error: 'This is not a valid URL' };
  }

  return {};
}
