import { Field } from '@egoist/solid-base/field';
import styles from './field.module.css';

export const title = 'Field';

export default function ExampleField() {
  return (
    <Field.Root class={styles.Field}>
      <Field.Label class={styles.Label}>Name</Field.Label>
      <Field.Control required placeholder="Required" class={styles.Input} />

      <Field.Error class={styles.Error} match="valueMissing">
        Please enter your name
      </Field.Error>

      <Field.Description class={styles.Description}>Visible on your profile</Field.Description>
    </Field.Root>
  );
}
