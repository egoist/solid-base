import { For, createSignal } from 'solid-js';
import { Field } from '@egoist/solid-base/field';
import { Form } from '@egoist/solid-base/form';
import { Radio } from '@egoist/solid-base/radio';
import { RadioGroup } from '@egoist/solid-base/radio-group';
import styles from './forms.module.css';

type Mode = Form.ValidationMode;

const MODES: Mode[] = ['onSubmit', 'onBlur', 'onChange'];
const TAKEN = ['admin', 'root', 'solid'];

export default function ValidationModes() {
  const [mode, setMode] = createSignal<Mode>('onChange');

  return (
    <div class={styles.Wrapper}>
      <Form class={styles.Form} validationMode={mode()}>
        <RadioGroup
          aria-label="Validation mode"
          value={mode()}
          onValueChange={(value) => setMode(value as Mode)}
          class={styles.Options}
        >
          <For each={MODES}>
            {(value) => (
              <label class={styles.Option}>
                <Radio.Root value={value} class={styles.Radio}>
                  <Radio.Indicator class={styles.RadioIndicator} />
                </Radio.Root>
                <code class={styles.Mono}>{value}</code>
              </label>
            )}
          </For>
        </RadioGroup>

        <Field.Root
          name="username"
          class={styles.Field}
          validationDebounceTime={300}
          validate={async (value) => {
            const username = String(value);
            if (username === 'admin') {
              return 'Reserved for system use.';
            }
            // Pretend to check the availability of the username on a server.
            await new Promise((resolve) => setTimeout(resolve, 300));
            if (TAKEN.includes(username)) {
              return `${username} is unavailable.`;
            }
            return null;
          }}
        >
          <Field.Label class={styles.Label}>Username</Field.Label>
          <Field.Control required minlength={3} placeholder="e.g. alice132" class={styles.Input} />
          <Field.Description class={styles.Description}>
            Try “admin” or “solid”.
          </Field.Description>
          <Field.Error class={styles.Error} />
        </Field.Root>

        <button type="submit" class={styles.Submit}>
          Submit
        </button>
      </Form>
    </div>
  );
}
