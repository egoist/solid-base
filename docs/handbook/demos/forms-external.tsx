import { Show, createSignal, createStore } from 'solid-js';
import { Field } from '@egoist/solid-base/field';
import { Form } from '@egoist/solid-base/form';
import styles from './forms.module.css';

interface FormValues {
  username: string;
  email: string;
}

type FieldName = keyof FormValues;

const initialValues: FormValues = { username: '', email: '' };

function validate(values: FormValues): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  if (!values.username) {
    errors.username = 'Username is required.';
  } else if (values.username.length < 3) {
    errors.username = 'At least 3 characters.';
  }
  if (!values.email) {
    errors.email = 'Email is required.';
  } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) {
    errors.email = 'Invalid email address.';
  }
  return errors;
}

export default function ExternalFormState() {
  // The form state lives outside of the components, as in a form library.
  const [values, setValues] = createStore<FormValues>({ ...initialValues });
  const [touched, setTouched] = createStore<Partial<Record<FieldName, boolean>>>({});
  const [submitCount, setSubmitCount] = createSignal(0);
  const [submitted, setSubmitted] = createSignal<FormValues>();

  // Validate every field after the first submission, then on every change.
  const errors = () => (submitCount() > 0 ? validate(values) : {});

  function TextField(props: { name: FieldName; label: string; placeholder: string }) {
    const error = () => errors()[props.name];
    return (
      <Field.Root
        name={props.name}
        invalid={error() != null}
        touched={touched[props.name] ?? false}
        dirty={values[props.name] !== initialValues[props.name]}
        class={styles.Field}
      >
        <Field.Label class={styles.Label}>{props.label}</Field.Label>
        <Field.Control
          value={values[props.name]}
          onValueChange={(value) =>
            setValues((draft) => {
              draft[props.name] = value;
            })
          }
          onBlur={() =>
            setTouched((draft) => {
              draft[props.name] = true;
            })
          }
          placeholder={props.placeholder}
          class={styles.Input}
        />
        <Field.Error match={error() != null} class={styles.Error}>
          {error()}
        </Field.Error>
      </Field.Root>
    );
  }

  return (
    <div class={styles.Wrapper}>
      <Form
        class={styles.Form}
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitCount((count) => count + 1);
          if (Object.keys(validate(values)).length === 0) {
            setSubmitted({ ...values });
          }
        }}
      >
        <TextField name="username" label="Username" placeholder="e.g. alice132" />
        <TextField name="email" label="Email" placeholder="e.g. alice@example.com" />
        <button type="submit" class={styles.Submit}>
          Submit
        </button>
      </Form>

      <Show when={submitted()}>
        {(data) => (
          <output class={styles.Output}>
            <span class={styles.OutputTitle}>submitted</span>
            <pre>{JSON.stringify(data(), null, 2)}</pre>
          </output>
        )}
      </Show>
    </div>
  );
}
