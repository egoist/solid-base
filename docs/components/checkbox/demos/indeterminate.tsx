import { createSignal } from 'solid-js';
import { Checkbox } from '@egoist/solid-base/checkbox';
import styles from './indeterminate.module.css';

export default function IndeterminateCheckbox() {
  const [indeterminate, setIndeterminate] = createSignal(true);

  return (
    <div class={styles.Stack}>
      <label class={styles.Label}>
        <Checkbox.Root indeterminate={indeterminate()} class={styles.Checkbox}>
          <Checkbox.Indicator
            class={styles.Indicator}
            render={(props, state) => (
              <span {...props}>{state.indeterminate ? <DashIcon /> : <CheckIcon />}</span>
            )}
          />
        </Checkbox.Root>
        Select all
      </label>
      <button
        type="button"
        class={styles.Button}
        onClick={() => setIndeterminate((value) => !value)}
      >
        {indeterminate() ? 'Clear' : 'Set'} indeterminate
      </button>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M2 8h12" />
    </svg>
  );
}
