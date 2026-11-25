import { Checkbox } from '@egoist/solid-base/checkbox';
import styles from './hero.module.css';

export default function CheckboxDemo() {
  return (
    <label class={styles.Label}>
      <Checkbox.Root defaultChecked class={styles.Checkbox}>
        <Checkbox.Indicator class={styles.Indicator}>
          <CheckIcon />
        </Checkbox.Indicator>
      </Checkbox.Root>
      Enable notifications
    </label>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
