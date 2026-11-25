import { createSignal, createUniqueId, Show } from 'solid-js';
import { Button } from '@egoist/solid-base/button';
import styles from './button.module.css';

export default function ExampleButtonLoading() {
  const [loading, setLoading] = createSignal(false);
  const labelId = createUniqueId();

  return (
    <Button
      class={styles.Button}
      disabled={loading()}
      focusableWhenDisabled
      aria-labelledby={labelId}
      onClick={() => {
        setLoading(true);
        setTimeout(() => setLoading(false), 4000);
      }}
    >
      <Show when={loading()}>
        <span class={styles.Spinner} aria-hidden="true" />
      </Show>
      <span id={labelId}>{loading() ? 'Submitting' : 'Submit'}</span>
    </Button>
  );
}
