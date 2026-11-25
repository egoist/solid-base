import { Checkbox } from '@egoist/solid-base/checkbox';
import styles from './checkbox.module.css';


export default function ExampleCheckbox() {
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

function CheckIcon(props: { class?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      class={props.class}
      style={{ display: 'block' }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
